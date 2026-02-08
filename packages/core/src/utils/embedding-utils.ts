/**
 * Embedding Type Utilities
 *
 * Prisma doesn't support optional arrays (Float[]?), but our database stores NULL
 * for records without embeddings. These utilities provide type-safe wrappers for
 * working with nullable embeddings.
 */

/**
 * Type representing an embedding that can be null (not yet generated) or an array of floats
 */
export type NullableEmbedding = number[] | null;

/**
 * Safely creates a null embedding value for Prisma operations.
 * Uses type assertion internally to bypass Prisma's Float[] type.
 */
export function nullEmbedding(): any {
  return null as any;
}

/**
 * Checks if an embedding is valid (non-null and non-empty)
 */
export function hasValidEmbedding(embedding: number[] | null | undefined): embedding is number[] {
  return embedding !== null && embedding !== undefined && embedding.length > 0;
}

/**
 * Type guard to safely narrow embedding type
 */
export function isValidEmbedding(embedding: unknown): embedding is number[] {
  return Array.isArray(embedding) && embedding.length > 0 && embedding.every(n => typeof n === 'number');
}
