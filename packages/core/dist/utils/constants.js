// ============================================================================
// SYSTEM IDENTIFIERS
// ============================================================================
/** UUID used to identify LLM system evaluations in the database */
export const LLM_SYSTEM_UUID = '00000000-0000-0000-0000-000000000000';
// ============================================================================
// JOB STATUS ENUMS
// ============================================================================
export const JobStatus = {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
    VECTORIZING: 'VECTORIZING',
    QUEUED_FOR_VEC: 'QUEUED_FOR_VEC',
};
// ============================================================================
// USER ROLES
// ============================================================================
export const UserRole = {
    USER: 'USER',
    QA: 'QA',
    CORE: 'CORE',
    FLEET: 'FLEET',
    MANAGER: 'MANAGER',
    ADMIN: 'ADMIN',
};
// ============================================================================
// RECORD TYPES
// ============================================================================
export const RecordType = {
    TASK: 'TASK',
    FEEDBACK: 'FEEDBACK',
};
// ============================================================================
// RECORD CATEGORIES
// ============================================================================
export const RecordCategory = {
    TOP_10: 'TOP_10',
    BOTTOM_10: 'BOTTOM_10',
    STANDARD: 'STANDARD',
};
// ============================================================================
// API ENDPOINTS
// ============================================================================
export const API_ENDPOINTS = {
    OPENROUTER_BASE: 'https://openrouter.ai/api/v1',
    OPENROUTER_AUTH: 'https://openrouter.ai/api/v1/auth/key',
    LM_STUDIO_DEFAULT: 'http://localhost:1234/v1',
    LOCAL_APP_DEFAULT: 'http://localhost:3000',
};
// ============================================================================
// SYSTEM SETTING KEYS (Database)
// ============================================================================
export const SystemSettingKeys = {
    AI_PROVIDER: 'ai_provider',
    AI_HOST: 'ai_host',
    LLM_MODEL: 'llm_model',
    EMBEDDING_MODEL: 'embedding_model',
    OPENROUTER_KEY: 'openrouter_key',
};
// ============================================================================
// AI PROVIDER TYPES
// ============================================================================
export const AIProviderConst = {
    LM_STUDIO: 'lmstudio',
    OPENROUTER: 'openrouter',
};
// ============================================================================
// DEFAULT MODELS
// ============================================================================
export const DefaultModels = {
    LM_STUDIO: {
        LLM: 'meta-llama-3-8b-instruct',
        EMBEDDING: 'text-embedding-nomic-embed-text-v1.5',
    },
    OPENROUTER: {
        LLM: 'anthropic/claude-3.5-sonnet',
        EMBEDDING: 'openai/text-embedding-3-small',
    },
};
export const LM_STUDIO_MODEL_OPTIONS = [
    'meta-llama-3.1-8b-instruct',
    'meta-llama-3-8b-instruct',
];
export const OPENROUTER_MODEL_OPTIONS = [
    'google/gemini-3-flash-preview',
    'anthropic/claude-sonnet-4.5',
    'anthropic/claude-opus-4.5',
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-oss-120b',
    'google/gemini-3-pro-preview',
    'openai/gpt-5.2-chat',
];
export const OPENROUTER_EMBEDDING_OPTIONS = [
    'openai/text-embedding-3-small',
    'openai/text-embedding-3-large',
    'openai/text-embedding-ada-002',
];
// ============================================================================
// SYSTEM PROMPTS
// ============================================================================
export const DEFAULT_SYSTEM_PROMPT = `You are an expert evaluator. Rate the given prompt/text on two dimensions using a 1-7 scale:
1. Realism (1=Not Realistic, 7=Very Realistic): How realistic and grounded is this prompt?
2. Quality (1=Poor Quality, 7=Excellent Quality): How well-written and useful is this prompt?

Respond in JSON format only: {"realism": <1-7>, "quality": <1-7>}`;
// ============================================================================
// LIKERT SCALE
// ============================================================================
export const LIKERT_SCALE = {
    MIN: 1,
    MAX: 7,
};
// ============================================================================
// BATCH SIZES & PROCESSING LIMITS
// ============================================================================
export const BatchSizes = {
    /** Number of records to process per evaluation batch */
    EVALUATION_BATCH: 10,
    /** Number of records to vectorize per batch */
    VECTORIZATION_BATCH: 50,
    /** Number of records to process per chunk in ingestion */
    INGESTION_CHUNK: 100,
    /** Maximum file upload chunk size (3MB) */
    FILE_UPLOAD_CHUNK: 3145728,
    /** Threshold for using chunked upload (3MB) */
    CHUNK_THRESHOLD: 3145728,
};
// ============================================================================
// RETRY CONFIGURATION
// ============================================================================
export const RetryConfig = {
    /** Maximum retries for embedding operations */
    MAX_EMBEDDING_RETRIES: 3,
    /** Maximum retries for file upload chunks */
    MAX_UPLOAD_RETRIES: 3,
    /** Delay between retries in milliseconds */
    RETRY_DELAY_MS: 1000,
};
// ============================================================================
// TIMEOUT VALUES (milliseconds)
// ============================================================================
export const Timeouts = {
    /** Timeout for embedding API requests */
    EMBEDDING_REQUEST: 60000,
    /** Delay between evaluation batches */
    EVALUATION_BATCH_DELAY: 500,
    /** Delay between vectorization batches */
    VECTORIZATION_BATCH_DELAY: 2000,
};
// ============================================================================
// POLLING INTERVALS (milliseconds)
// ============================================================================
export const PollingIntervals = {
    /** Polling interval for ingestion status updates */
    INGESTION_STATUS: 2000,
    /** Polling interval for AI balance checks */
    AI_BALANCE: 60000,
    /** Polling interval for general status page */
    STATUS_PAGE: 30000,
};
// ============================================================================
// LLM REQUEST CONFIGURATION
// ============================================================================
export const LLMConfig = {
    /** Temperature for standard completions */
    COMPLETION_TEMPERATURE: 0.7,
    /** Temperature for evaluation requests (lower = more consistent) */
    EVALUATION_TEMPERATURE: 0.3,
    /** Maximum tokens for evaluation responses (higher for reasoning models like o1/o3/gpt-5.2) */
    EVALUATION_MAX_TOKENS: 500,
    /** Maximum prompt length before truncation */
    MAX_PROMPT_LENGTH: 20000,
};
// ============================================================================
// HTTP HEADERS
// ============================================================================
export const HTTPHeaders = {
    CONTENT_TYPE: 'Content-Type',
    AUTHORIZATION: 'Authorization',
    REFERER: 'HTTP-Referer',
    TITLE: 'X-Title',
    DEFAULT_TITLE: 'Operations Tools',
    BULK_EVAL_TITLE: 'Bulk Eval',
};
// ============================================================================
// HTTP STATUS CODES
// ============================================================================
export const HTTPStatus = {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    PAYMENT_REQUIRED: 402,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_ERROR: 500,
};
// ============================================================================
// PRISMA ERROR CODES
// ============================================================================
export const PrismaErrorCode = {
    /** Unique constraint violation */
    UNIQUE_CONSTRAINT: 'P2002',
    /** Record not found */
    RECORD_NOT_FOUND: 'P2025',
};
// ============================================================================
// CSV PARSING OPTIONS
// ============================================================================
export const CSV_PARSE_OPTIONS = {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
};
// ============================================================================
// CONTENT FIELD NAMES (for flexible CSV/API ingestion)
// ============================================================================
export const ContentFieldNames = [
    'feedback_content',
    'feedback',
    'prompt',
    'content',
    'body',
    'task_content',
    'text',
    'message',
    'instruction',
    'response',
];
export const RatingFieldNames = [
    'prompt_quality_rating',
    'feedback_quality_rating',
    'quality_rating',
    'rating',
    'category',
    'label',
    'score',
    'avg_score',
];
export const IdFieldNames = [
    'task_id',
    'id',
    'uuid',
    'record_id',
];
export const TimestampFieldNames = {
    CREATED: ['created_at', 'createdAt', 'timestamp', 'date_created'],
    UPDATED: ['updated_at', 'updatedAt', 'date_updated', 'modified_at'],
};
export const CreatorFieldNames = {
    ID: 'created_by_id',
    NAME: 'created_by_name',
    EMAIL: 'created_by_email',
};
// ============================================================================
// CATEGORY DETECTION KEYWORDS
// ============================================================================
export const CategoryKeywords = {
    TOP_10: ['top', 'selected', 'better', 'top_10', 'top10'],
    BOTTOM_10: ['bottom', 'rejected', 'worse', 'bottom_10', 'bottom10'],
};
// ============================================================================
// ENVIRONMENT VARIABLES (Default Fallbacks)
// ============================================================================
export const EnvDefaults = {
    AI_HOST: 'http://localhost:1234/v1',
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
    OPENROUTER_REFERER: 'http://localhost:3000',
    OPENROUTER_TITLE: 'Operations Tools',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
};
