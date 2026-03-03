import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';
import { analyzePromptAuthenticity } from '@repo/core';
import { logAudit } from '@repo/core/audit';

// ============================================================================
// VERCEL CONFIGURATION - Increase timeout for long-running analysis jobs
// ============================================================================
export const maxDuration = 300; // 5 minutes (Pro plan max)

// ============================================================================
// HIERARCHICAL PERMISSION HELPER (inline for now, TODO: extract to shared package)
// ============================================================================
type UserRole = 'USER' | 'QA' | 'CORE' | 'FLEET' | 'MANAGER' | 'ADMIN';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  USER: 1,
  QA: 2,
  CORE: 3,
  FLEET: 4,
  MANAGER: 4, // Same as FLEET (deprecated)
  ADMIN: 5,
};

function hasPermission(userRole: string | null | undefined, requiredRole: UserRole): boolean {
  if (!userRole) return false;
  const userLevel = ROLE_HIERARCHY[userRole as UserRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
  return userLevel >= requiredLevel;
}

// ============================================================================
// AUTH HELPER (using hierarchical permissions)
// ============================================================================
async function requireFleetAuth(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  // Use hierarchical permission check: FLEET and above (includes MANAGER and ADMIN)
  if (!hasPermission(profile.role, 'FLEET')) {
    return { error: NextResponse.json({
      error: 'Forbidden - FLEET role or higher required'
    }, { status: 403 }) };
  }

  return { profile, user };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Helper function to chunk array into smaller arrays
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Helper to validate and parse date inputs
function parseAndValidateDate(dateString: string | null | undefined, fieldName: string): Date | null {
  if (!dateString) return null;

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName}: "${dateString}"`);
  }

  return date;
}

// ============================================================================
// ZOMBIE JOB CLEANUP (runs on server startup and before new job creation)
// ============================================================================
const ZOMBIE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

async function cleanupZombieJobs() {
  try {
    const zombieThreshold = new Date(Date.now() - ZOMBIE_TIMEOUT_MS);

    // Find RUNNING jobs with no recent heartbeat (likely killed by serverless runtime)
    const zombieJobs = await prisma.promptAuthenticityJob.findMany({
      where: {
        status: 'RUNNING',
        OR: [
          { lastHeartbeat: null },
          { lastHeartbeat: { lt: zombieThreshold } }
        ],
        startedAt: { lt: zombieThreshold } // Must be older than threshold
      }
    });

    if (zombieJobs.length > 0) {
      console.log(`[Zombie Cleanup] Found ${zombieJobs.length} zombie jobs, marking as FAILED`);

      await prisma.promptAuthenticityJob.updateMany({
        where: {
          id: { in: zombieJobs.map(j => j.id) }
        },
        data: {
          status: 'FAILED',
          errorMessage: 'Job killed by serverless runtime timeout or server restart'
        }
      });
    }

    // Also cleanup orphaned ANALYZING records (records stuck in ANALYZING status)
    const orphanedCount = await prisma.promptAuthenticityRecord.updateMany({
      where: {
        analysisStatus: 'ANALYZING',
        updatedAt: { lt: zombieThreshold }
      },
      data: {
        analysisStatus: 'PENDING',
        errorMessage: 'Reset from ANALYZING - likely job was interrupted'
      }
    });

    if (orphanedCount.count > 0) {
      console.log(`[Zombie Cleanup] Reset ${orphanedCount.count} orphaned ANALYZING records to PENDING`);
    }
  } catch (error) {
    console.error('[Zombie Cleanup] Error during cleanup:', error);
    // Don't throw - cleanup failure shouldn't block new jobs
  }
}

// ============================================================================
// POST: Start a new analysis job
// ============================================================================
export async function POST(request: NextRequest) {
  const authResult = await requireFleetAuth(request);
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json();
    let { batchSize = 40, startDate, endDate, limit } = body;

    // VALIDATION: Clamp batchSize to safe range (1-500)
    batchSize = Math.max(1, Math.min(batchSize, 500));

    // VALIDATION: Parse and validate dates
    let parsedStartDate: Date | null = null;
    let parsedEndDate: Date | null = null;

    try {
      parsedStartDate = parseAndValidateDate(startDate, 'startDate');
      parsedEndDate = parseAndValidateDate(endDate, 'endDate');
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // ZOMBIE CLEANUP: Clean up any stale jobs before starting new one
    await cleanupZombieJobs();

    // CONCURRENCY GUARD: Check for existing RUNNING jobs
    const existingJob = await prisma.promptAuthenticityJob.findFirst({
      where: { status: 'RUNNING' }
    });

    if (existingJob) {
      return NextResponse.json(
        {
          error: 'A job is already running. Please wait for it to complete or cancel it first.',
          jobId: existingJob.id
        },
        { status: 409 }
      );
    }

    // Build where clause with optional date range
    const where: any = {
      analysisStatus: 'PENDING',
      // VERSION CHECK DISABLED - Analyze all versions for now
      // versionNo: 1
    };

    if (parsedStartDate || parsedEndDate) {
      where.createdAt = {};
      if (parsedStartDate) {
        where.createdAt.gte = parsedStartDate;
      }
      if (parsedEndDate) {
        where.createdAt.lte = parsedEndDate;
      }
    }

    // Count pending prompts in date range
    let totalPending = await prisma.promptAuthenticityRecord.count({
      where,
    });

    // Apply limit if specified (for testing)
    if (limit && limit > 0) {
      totalPending = Math.min(totalPending, limit);
    }

    if (totalPending === 0) {
      return NextResponse.json({ error: 'No pending prompts to analyze' }, { status: 400 });
    }

    // Create job with batchSize and initial heartbeat
    const job = await prisma.promptAuthenticityJob.create({
      data: {
        status: 'RUNNING',
        totalPrompts: totalPending,
        batchSize,
        filterStartDate: parsedStartDate,
        filterEndDate: parsedEndDate,
        startedAt: new Date(),
        lastHeartbeat: new Date(),
      },
    });

    logAudit({
      action: 'AI_PROMPT_AUTHENTICITY_JOB_STARTED',
      entityType: 'AI_REQUEST',
      entityId: job.id,
      userId: authResult.user!.id,
      userEmail: authResult.user!.email!,
      metadata: { jobId: job.id, totalPrompts: totalPending, batchSize },
    });

    // Start processing in background (don't await)
    processAnalysisJob(job.id, batchSize).catch(error => {
      console.error('Background job error:', error);
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      totalPrompts: totalPending,
      batchSize,
      message: `Started analysis job for ${totalPending} prompts (batch size: ${batchSize})`,
    });
  } catch (error: any) {
    console.error('Start job error:', error);
    return NextResponse.json(
      { error: 'Failed to start analysis job', details: error.message },
      { status: 500 },
    );
  }
}

// ============================================================================
// Background job processor with parallel processing
// ============================================================================
async function processAnalysisJob(jobId: string, batchSize: number) {
  // Concurrency limit: Process up to 60 prompts in parallel
  // Custom OpenRouter rate limits allow for high concurrency
  const CONCURRENT_ANALYSES = 15;
  const HEARTBEAT_INTERVAL_MS = 30000; // Update heartbeat every 30 seconds

  let heartbeatInterval: NodeJS.Timeout | null = null;

  try {
    // Start heartbeat interval to detect zombie jobs
    heartbeatInterval = setInterval(async () => {
      try {
        await prisma.promptAuthenticityJob.update({
          where: { id: jobId },
          data: { lastHeartbeat: new Date() }
        });
      } catch (error) {
        console.error(`[Job ${jobId}] Heartbeat update failed:`, error);
      }
    }, HEARTBEAT_INTERVAL_MS);

    while (true) {
      // Check if job was paused or cancelled
      const job = await prisma.promptAuthenticityJob.findUnique({
        where: { id: jobId },
      });

      if (!job || job.status === 'PAUSED' || job.status === 'CANCELLED') {
        if (job?.status === 'PAUSED') {
          await prisma.promptAuthenticityJob.update({
            where: { id: jobId },
            data: { pausedAt: new Date() },
          });
        }
        break;
      }

      // Build where clause with date range from job
      const where: any = {
        analysisStatus: 'PENDING',
        // VERSION CHECK DISABLED - Analyze all versions for now
        // versionNo: 1
      };
      if (job.filterStartDate || job.filterEndDate) {
        where.createdAt = {};
        if (job.filterStartDate) {
          where.createdAt.gte = job.filterStartDate;
        }
        if (job.filterEndDate) {
          where.createdAt.lte = job.filterEndDate;
        }
      }

      // Check if we've reached the limit
      if (job.analyzedPrompts >= job.totalPrompts) {
        // Job complete - reached the limit
        await prisma.promptAuthenticityJob.update({
          where: { id: jobId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });
        break;
      }

      // Calculate how many more records we can process
      const remaining = job.totalPrompts - job.analyzedPrompts;
      const actualBatchSize = Math.min(batchSize, remaining);

      // Get next batch of pending prompts
      const prompts = await prisma.promptAuthenticityRecord.findMany({
        where,
        take: actualBatchSize,
        select: { id: true, versionId: true, prompt: true },
      });

      if (prompts.length === 0) {
        // Job complete
        await prisma.promptAuthenticityJob.update({
          where: { id: jobId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });
        break;
      }

      // Split batch into concurrent chunks
      const chunks = chunkArray(prompts, CONCURRENT_ANALYSES);
      console.log(`[Job ${jobId}] Processing ${prompts.length} prompts in ${chunks.length} parallel chunks of up to ${CONCURRENT_ANALYSES}`);

      // Process each chunk in parallel
      for (const chunk of chunks) {
        // Process all prompts in chunk concurrently
        const results = await Promise.allSettled(
          chunk.map(async (prompt) => {
            try {
              // Mark as analyzing
              await prisma.promptAuthenticityRecord.update({
                where: { id: prompt.id },
                data: { analysisStatus: 'ANALYZING' },
              });

              // Run analysis with silent flag to prevent notification spam
              const result = await analyzePromptAuthenticity(
                prompt.versionId,
                prompt.prompt,
                { silent: true }
              );

              // Save results
              await prisma.promptAuthenticityRecord.update({
                where: { id: prompt.id },
                data: {
                  analysisStatus: 'COMPLETED',
                  isLikelyNonNative: result.isLikelyNonNative,
                  nonNativeConfidence: result.nonNativeConfidence,
                  nonNativeIndicators: result.nonNativeIndicators as any,
                  isLikelyAIGenerated: result.isLikelyAIGenerated,
                  aiGeneratedConfidence: result.aiGeneratedConfidence,
                  aiGeneratedIndicators: result.aiGeneratedIndicators as any,
                  overallAssessment: result.overallAssessment,
                  recommendations: result.recommendations as any,
                  llmModel: result.llmModel,
                  llmProvider: result.llmProvider,
                  llmCost: result.llmCost,
                  analyzedAt: new Date(),
                },
              });

              return {
                success: true,
                promptId: prompt.id,
                versionId: prompt.versionId,
                result,
              };
            } catch (error) {
              console.error(`[Job ${jobId}] Error analyzing prompt ${prompt.versionId}:`, error);

              // Mark as failed
              await prisma.promptAuthenticityRecord.update({
                where: { id: prompt.id },
                data: {
                  analysisStatus: 'FAILED',
                  errorMessage: error instanceof Error ? error.message : 'Unknown error',
                },
              });

              return {
                success: false,
                promptId: prompt.id,
                versionId: prompt.versionId,
                error,
              };
            }
          })
        );

        // Count successes and failures in this chunk
        let successCount = 0;
        let failedCount = 0;
        let flaggedNonNativeCount = 0;
        let flaggedAIGeneratedCount = 0;
        let totalCostSum = 0;

        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value.success && result.value.result) {
            successCount++;
            if (result.value.result.isLikelyNonNative) flaggedNonNativeCount++;
            if (result.value.result.isLikelyAIGenerated) flaggedAIGeneratedCount++;
            totalCostSum += result.value.result.llmCost || 0;
          } else {
            failedCount++;
          }
        });

        // Update job stats once per chunk (batch update) and heartbeat
        const updatedJob = await prisma.promptAuthenticityJob.update({
          where: { id: jobId },
          data: {
            analyzedPrompts: { increment: successCount },
            failedPrompts: { increment: failedCount },
            flaggedNonNative: { increment: flaggedNonNativeCount },
            flaggedAIGenerated: { increment: flaggedAIGeneratedCount },
            totalCost: { increment: totalCostSum },
            lastHeartbeat: new Date(),
          },
        });

        console.log(`[Job ${jobId}] Chunk complete: ${successCount} analyzed, ${failedCount} failed. Total: ${updatedJob.analyzedPrompts}/${updatedJob.totalPrompts}`);
      }
    }
  } catch (error) {
    console.error(`[Job ${jobId}] Fatal error:`, error);
    await prisma.promptAuthenticityJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  } finally {
    // Clear heartbeat interval
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
  }
}

// ============================================================================
// PATCH: Pause/resume/cancel job
// ============================================================================
export async function PATCH(request: NextRequest) {
  const authResult = await requireFleetAuth(request);
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json();
    const { jobId, action } = body;

    if (!jobId || !action) {
      return NextResponse.json({ error: 'Missing jobId or action' }, { status: 400 });
    }

    const job = await prisma.promptAuthenticityJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (action === 'pause') {
      await prisma.promptAuthenticityJob.update({
        where: { id: jobId },
        data: { status: 'PAUSED', pausedAt: new Date() },
      });
      return NextResponse.json({ success: true, message: 'Job paused' });
    }

    if (action === 'resume') {
      await prisma.promptAuthenticityJob.update({
        where: { id: jobId },
        data: { status: 'RUNNING', pausedAt: null, lastHeartbeat: new Date() },
      });

      // Restart processing with stored batchSize from job
      processAnalysisJob(jobId, job.batchSize).catch(error => {
        console.error('Resume job error:', error);
      });

      return NextResponse.json({ success: true, message: 'Job resumed' });
    }

    if (action === 'cancel') {
      await prisma.promptAuthenticityJob.update({
        where: { id: jobId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      return NextResponse.json({ success: true, message: 'Job cancelled' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Job control error:', error);
    return NextResponse.json(
      { error: 'Failed to control job', details: error.message },
      { status: 500 },
    );
  }
}

// ============================================================================
// GET: Get job status
// ============================================================================
export async function GET(request: NextRequest) {
  const authResult = await requireFleetAuth(request);
  if (authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (jobId) {
      // Get specific job
      const job = await prisma.promptAuthenticityJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }

      return NextResponse.json(job);
    }

    // Get all jobs
    const jobs = await prisma.promptAuthenticityJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({ jobs });
  } catch (error: any) {
    console.error('Get job error:', error);
    return NextResponse.json(
      { error: 'Failed to get job status', details: error.message },
      { status: 500 },
    );
  }
}
