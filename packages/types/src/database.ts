// Re-export Prisma types and enums
export type {
  Project,
  Profile,
  DataRecord,
  IngestJob,
  AnalyticsJob,
  BonusWindow,
  SystemSetting,
  AuditLog,
  BugReport,
  RaterGroup,
  AssignmentBatch,
  AssignmentRecord,
  CandidateStatus,
  LikertScore,
  LLMEvaluationJob,
  LLMModelConfig,
  CrossEncoderCache,
  RaterGroupMember
} from '@prisma/client';

// Re-export enums
export {
  UserRole,
  RecordType,
  RecordCategory,
  JobStatus,
  AssignmentStatus,
  RecordAssignmentStatus
} from '@prisma/client';

// Extended types for common query patterns
export interface ProjectWithRecordCount {
  id: string;
  name: string;
  guidelines: string | null;
  guidelinesFileName: string | null;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    records: number;
  };
}

export interface ProfileWithRole {
  id: string;
  email: string;
  role: import('@prisma/client').UserRole;
  mustResetPassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}
