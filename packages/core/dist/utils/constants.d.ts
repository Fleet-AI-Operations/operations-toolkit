/** UUID used to identify LLM system evaluations in the database */
export declare const LLM_SYSTEM_UUID = "00000000-0000-0000-0000-000000000000";
export declare const JobStatus: {
    readonly PENDING: "PENDING";
    readonly PROCESSING: "PROCESSING";
    readonly COMPLETED: "COMPLETED";
    readonly FAILED: "FAILED";
    readonly CANCELLED: "CANCELLED";
    readonly VECTORIZING: "VECTORIZING";
    readonly QUEUED_FOR_VEC: "QUEUED_FOR_VEC";
};
export type JobStatusType = typeof JobStatus[keyof typeof JobStatus];
export declare const UserRole: {
    readonly USER: "USER";
    readonly QA: "QA";
    readonly CORE: "CORE";
    readonly FLEET: "FLEET";
    readonly MANAGER: "MANAGER";
    readonly ADMIN: "ADMIN";
};
export type UserRoleType = typeof UserRole[keyof typeof UserRole];
export declare const RecordType: {
    readonly TASK: "TASK";
    readonly FEEDBACK: "FEEDBACK";
};
export type RecordTypeValue = typeof RecordType[keyof typeof RecordType];
export declare const RecordCategory: {
    readonly TOP_10: "TOP_10";
    readonly BOTTOM_10: "BOTTOM_10";
    readonly STANDARD: "STANDARD";
};
export type RecordCategoryType = typeof RecordCategory[keyof typeof RecordCategory];
export declare const API_ENDPOINTS: {
    readonly OPENROUTER_BASE: "https://openrouter.ai/api/v1";
    readonly OPENROUTER_AUTH: "https://openrouter.ai/api/v1/auth/key";
    readonly LM_STUDIO_DEFAULT: "http://localhost:1234/v1";
    readonly LOCAL_APP_DEFAULT: "http://localhost:3000";
};
export declare const SystemSettingKeys: {
    readonly AI_PROVIDER: "ai_provider";
    readonly AI_HOST: "ai_host";
    readonly LLM_MODEL: "llm_model";
    readonly EMBEDDING_MODEL: "embedding_model";
    readonly OPENROUTER_KEY: "openrouter_key";
};
export declare const AIProviderConst: {
    readonly LM_STUDIO: "lmstudio";
    readonly OPENROUTER: "openrouter";
};
export type AIProviderType = typeof AIProviderConst[keyof typeof AIProviderConst];
export declare const DefaultModels: {
    readonly LM_STUDIO: {
        readonly LLM: "meta-llama-3-8b-instruct";
        readonly EMBEDDING: "text-embedding-nomic-embed-text-v1.5";
    };
    readonly OPENROUTER: {
        readonly LLM: "anthropic/claude-3.5-sonnet";
        readonly EMBEDDING: "openai/text-embedding-3-small";
    };
};
export declare const LM_STUDIO_MODEL_OPTIONS: readonly ["meta-llama-3.1-8b-instruct", "meta-llama-3-8b-instruct"];
export declare const OPENROUTER_MODEL_OPTIONS: readonly ["google/gemini-3-flash-preview", "anthropic/claude-sonnet-4.5", "anthropic/claude-opus-4.5", "anthropic/claude-3.5-sonnet", "openai/gpt-oss-120b", "google/gemini-3-pro-preview", "openai/gpt-5.2-chat"];
export declare const OPENROUTER_EMBEDDING_OPTIONS: readonly ["openai/text-embedding-3-small", "openai/text-embedding-3-large", "openai/text-embedding-ada-002"];
export declare const DEFAULT_SYSTEM_PROMPT = "You are an expert evaluator. Rate the given prompt/text on two dimensions using a 1-7 scale:\n1. Realism (1=Not Realistic, 7=Very Realistic): How realistic and grounded is this prompt?\n2. Quality (1=Poor Quality, 7=Excellent Quality): How well-written and useful is this prompt?\n\nRespond in JSON format only: {\"realism\": <1-7>, \"quality\": <1-7>}";
export declare const LIKERT_SCALE: {
    readonly MIN: 1;
    readonly MAX: 7;
};
export declare const BatchSizes: {
    /** Number of records to process per evaluation batch */
    readonly EVALUATION_BATCH: 10;
    /** Number of records to vectorize per batch */
    readonly VECTORIZATION_BATCH: 50;
    /** Number of records to process per chunk in ingestion */
    readonly INGESTION_CHUNK: 100;
    /** Maximum file upload chunk size (3MB) */
    readonly FILE_UPLOAD_CHUNK: 3145728;
    /** Threshold for using chunked upload (3MB) */
    readonly CHUNK_THRESHOLD: 3145728;
};
export declare const RetryConfig: {
    /** Maximum retries for embedding operations */
    readonly MAX_EMBEDDING_RETRIES: 3;
    /** Maximum retries for file upload chunks */
    readonly MAX_UPLOAD_RETRIES: 3;
    /** Delay between retries in milliseconds */
    readonly RETRY_DELAY_MS: 1000;
};
export declare const Timeouts: {
    /** Timeout for embedding API requests */
    readonly EMBEDDING_REQUEST: 60000;
    /** Delay between evaluation batches */
    readonly EVALUATION_BATCH_DELAY: 500;
    /** Delay between vectorization batches */
    readonly VECTORIZATION_BATCH_DELAY: 2000;
};
export declare const PollingIntervals: {
    /** Polling interval for ingestion status updates */
    readonly INGESTION_STATUS: 2000;
    /** Polling interval for AI balance checks */
    readonly AI_BALANCE: 60000;
    /** Polling interval for general status page */
    readonly STATUS_PAGE: 30000;
};
export declare const LLMConfig: {
    /** Temperature for standard completions */
    readonly COMPLETION_TEMPERATURE: 0.7;
    /** Temperature for evaluation requests (lower = more consistent) */
    readonly EVALUATION_TEMPERATURE: 0.3;
    /** Maximum tokens for evaluation responses (higher for reasoning models like o1/o3/gpt-5.2) */
    readonly EVALUATION_MAX_TOKENS: 500;
    /** Maximum prompt length before truncation */
    readonly MAX_PROMPT_LENGTH: 20000;
};
export declare const HTTPHeaders: {
    readonly CONTENT_TYPE: "Content-Type";
    readonly AUTHORIZATION: "Authorization";
    readonly REFERER: "HTTP-Referer";
    readonly TITLE: "X-Title";
    readonly DEFAULT_TITLE: "Operations Tools";
    readonly BULK_EVAL_TITLE: "Bulk Eval";
};
export declare const HTTPStatus: {
    readonly OK: 200;
    readonly BAD_REQUEST: 400;
    readonly UNAUTHORIZED: 401;
    readonly PAYMENT_REQUIRED: 402;
    readonly FORBIDDEN: 403;
    readonly NOT_FOUND: 404;
    readonly TOO_MANY_REQUESTS: 429;
    readonly INTERNAL_ERROR: 500;
};
export declare const PrismaErrorCode: {
    /** Unique constraint violation */
    readonly UNIQUE_CONSTRAINT: "P2002";
    /** Record not found */
    readonly RECORD_NOT_FOUND: "P2025";
};
export declare const CSV_PARSE_OPTIONS: {
    readonly columns: true;
    readonly skip_empty_lines: true;
    readonly trim: true;
    readonly relax_column_count: true;
};
export declare const ContentFieldNames: readonly ["feedback_content", "feedback", "prompt", "content", "body", "task_content", "text", "message", "instruction", "response"];
export declare const RatingFieldNames: readonly ["prompt_quality_rating", "feedback_quality_rating", "quality_rating", "rating", "category", "label", "score", "avg_score"];
export declare const IdFieldNames: readonly ["task_id", "id", "uuid", "record_id"];
export declare const TimestampFieldNames: {
    readonly CREATED: readonly ["created_at", "createdAt", "timestamp", "date_created"];
    readonly UPDATED: readonly ["updated_at", "updatedAt", "date_updated", "modified_at"];
};
export declare const CreatorFieldNames: {
    readonly ID: "created_by_id";
    readonly NAME: "created_by_name";
    readonly EMAIL: "created_by_email";
};
export declare const CategoryKeywords: {
    readonly TOP_10: readonly ["top", "selected", "better", "top_10", "top10"];
    readonly BOTTOM_10: readonly ["bottom", "rejected", "worse", "bottom_10", "bottom10"];
};
export declare const EnvDefaults: {
    readonly AI_HOST: "http://localhost:1234/v1";
    readonly OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1";
    readonly OPENROUTER_REFERER: "http://localhost:3000";
    readonly OPENROUTER_TITLE: "Operations Tools";
    readonly NEXT_PUBLIC_APP_URL: "http://localhost:3000";
};
//# sourceMappingURL=constants.d.ts.map