import type { UserRole, RecordType, RecordCategory } from './database';
export interface AuthenticatedUser {
    id: string;
    email: string;
    role: UserRole;
}
export interface CreateProjectRequest {
    name: string;
    guidelines?: string;
    guidelinesFileName?: string;
}
export interface UpdateProjectRequest {
    id: string;
    name?: string;
    guidelines?: string;
    guidelinesFileName?: string;
}
export interface CreateRecordRequest {
    projectId: string;
    type: RecordType;
    category: RecordCategory;
    source: string;
    content: string;
    metadata?: Record<string, any>;
}
export interface UpdateRecordRequest {
    id: string;
    hasBeenReviewed?: boolean;
    isCategoryCorrect?: boolean;
    reviewedBy?: string;
    reviewedAt?: Date;
    alignmentAnalysis?: string;
}
export interface IngestJobResponse {
    id: string;
    projectId: string;
    status: string;
    totalRecords: number;
    processedRecords: number;
    vectorizedRecords: number;
    failedRecords: number;
    error: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateUserRequest {
    email: string;
    role: UserRole;
    temporaryPassword: string;
}
export interface UpdateUserRoleRequest {
    userId: string;
    role: UserRole;
}
export interface ApiResponse<T = any> {
    data?: T;
    error?: string;
    message?: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    error?: string;
    message?: string;
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}
//# sourceMappingURL=api.d.ts.map