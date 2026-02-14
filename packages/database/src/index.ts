import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: pg.Pool | undefined;
};

// Lazy initialize the database connection
function getPool() {
  if (!globalForPrisma.pool) {
    const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;

    if (!databaseUrl) {
      throw new Error('Database URL not found. Set DATABASE_URL, POSTGRES_PRISMA_URL, or POSTGRES_URL environment variable.');
    }

    globalForPrisma.pool = new pg.Pool({ connectionString: databaseUrl });
  }
  return globalForPrisma.pool;
}

function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    const pool = getPool();
    const adapter = new PrismaPg(pool);

    globalForPrisma.prisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
    });
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop) {
    const client = getPrismaClient();
    return client[prop as keyof PrismaClient];
  }
});

// Explicitly re-export commonly used Prisma types
export {
  Prisma,
  PrismaClient,
  UserRole,
  RecordType,
  RecordCategory,
  JobStatus,
  AssignmentStatus,
  RecordAssignmentStatus,
} from '@prisma/client';

// Re-export types (not runtime values)
export type {
  Profile,
  Project,
  DataRecord,
  IngestJob,
  AnalyticsJob,
  SystemSetting,
  NotificationSetting,
  BonusWindow,
  AssignmentBatch,
  AssignmentRecord,
  BugReport,
  TimeEntry,
  AuditLog,
  LikertScore,
  CrossEncoderCache,
  CandidateStatus,
  RaterGroup,
  RaterGroupMember,
  LLMModelConfig,
  LLMEvaluationJob,
} from '@prisma/client';
