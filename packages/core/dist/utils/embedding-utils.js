/**
 * Embedding Type Utilities
 *
 * Prisma doesn't support optional arrays (Float[]?), but our database stores NULL
 * for records without embeddings. These utilities provide type-safe wrappers for
 * working with nullable embeddings.
 */
/**
 * Safely creates a null embedding value for Prisma operations.
 * Uses type assertion internally to bypass Prisma's Float[] type.
 */
export function nullEmbedding() {
    return null;
}
/**
 * Checks if an embedding is valid (non-null and non-empty)
 */
export function hasValidEmbedding(embedding) {
    return embedding !== null && embedding !== undefined && embedding.length > 0;
}
/**
 * Type guard to safely narrow embedding type
 */
export function isValidEmbedding(embedding) {
    return Array.isArray(embedding) && embedding.length > 0 && embedding.every(n => typeof n === 'number');
}
