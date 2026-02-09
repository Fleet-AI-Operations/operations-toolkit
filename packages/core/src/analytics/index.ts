/**
 * ANALYTICS ENGINE - Specialized for bulk processing and heavy-duty LLM tasks.
 */
import { prisma } from '@repo/database';
import { generateCompletion } from '../ai';
// @ts-ignore
import { extractTextFromPDF } from '../utils/pdf';

/**
 * ENTRY POINT: startBulkAlignment
 */
export async function startBulkAlignment(projectId: string) {
  // Check if there's already an active job for this project
  const activeJob = await prisma.analyticsJob.findFirst({
    where: { projectId, status: 'PROCESSING' }
  });
  if (activeJob) return activeJob.id;

  // Identify records that need alignment analysis
  const targetCount = await prisma.dataRecord.count({
    where: { projectId, alignmentAnalysis: null }
  });

  if (targetCount === 0) return null;

  const job = await prisma.analyticsJob.create({
    data: {
      projectId,
      status: 'PROCESSING',
      totalRecords: targetCount,
      processedCount: 0
    }
  });

  // Fire and forget the background worker
  runBulkAlignment(job.id, projectId).catch(err => console.error('Bulk Alignment Error:', err));

  return job.id;
}

/**
 * BACKGROUND WORKER: runBulkAlignment
 */
async function runBulkAlignment(jobId: string, projectId: string) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project || !project.guidelines) {
      throw new Error('Project guidelines not found.');
    }

    // 1. EXTRACT GUIDELINES once per job to save resources
    let guidelinesText = '';
    const base64Data = project.guidelines.split(';base64,').pop();
    if (base64Data) {
      const buffer = Buffer.from(base64Data, 'base64');
      const parsed = await extractTextFromPDF(buffer);
      guidelinesText = parsed.text;
    }

    if (!guidelinesText) throw new Error('Could not parse guidelines PDF.');

    // 2. FETCH and PROCESS in sequence (LLM is usually the bottleneck, don't overwhelm local host)
    const recordsToProcess = await prisma.dataRecord.findMany({
      where: { projectId, alignmentAnalysis: null },
      orderBy: { createdAt: 'desc' }
    });

    const systemPrompt = `You are an expert AI Alignment Lead and Quality Assurance Analyst for the ${project.name} project.`;

    for (let i = 0; i < recordsToProcess.length; i++) {
      // CHECK FOR CANCELLED STATUS periodically
      const currentJob = await prisma.analyticsJob.findUnique({
        where: { id: jobId },
        select: { status: true }
      });
      if (currentJob?.status === 'CANCELLED') break;

      const record = recordsToProcess[i];

      const prompt = `
        Evaluate the following ${record.type === 'TASK' ? 'prompt' : 'feedback'} against the provided project guidelines.

        ### PROJECT GUIDELINES
        ${guidelinesText}

        ### CONTENT TO EVALUATE
        ${record.content}

        Please provide:
        1. **Guideline Alignment Score (0-100)**: How well does this follow the guidelines?
        2. **Detailed Analysis**: A breakdown of which guidelines were followed and which were missed.
        3. **Suggested Improvements**: How could this be modified to better align with the guidelines?

        Return the evaluation in a structured format with clear headings.
      `;

      try {
        const evaluation = await generateCompletion(prompt, systemPrompt);

        await prisma.dataRecord.update({
          where: { id: record.id },
          data: { alignmentAnalysis: evaluation }
        });
      } catch (err) {
        console.error(`Failed to process record ${record.id}:`, err);
        // Continue with next record even if one fails
      }

      // Update progress
      await prisma.analyticsJob.update({
        where: { id: jobId },
        data: { processedCount: i + 1 }
      });
    }

    // Final Status Update
    const finalJob = await prisma.analyticsJob.findUnique({ where: { id: jobId } });
    if (finalJob?.status !== 'CANCELLED') {
      await prisma.analyticsJob.update({
        where: { id: jobId },
        data: { status: 'COMPLETED' }
      });
    }

  } catch (error: any) {
    console.error('Bulk Job Fatal Error:', error);
    await prisma.analyticsJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', error: error.message }
    });
  }
}
