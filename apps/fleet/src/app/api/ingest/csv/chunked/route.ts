import { NextRequest, NextResponse } from 'next/server';
import { startBackgroundIngestFromSession } from '@repo/core/ingestion';
import { prisma } from '@repo/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Security limits
const MAX_CHUNKS = 100;
const MAX_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB per chunk
const MAX_TOTAL_SIZE = 150 * 1024 * 1024; // 150MB total
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Sanitize uploadId to prevent injection via the primary key
function safeId(uploadId: string): string {
    return uploadId.replace(/[^a-zA-Z0-9_-]/g, '');
}

async function cleanupExpiredSessions(): Promise<void> {
    await prisma.$executeRaw`DELETE FROM public.upload_sessions WHERE expires_at < NOW()`;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action } = body;

        // Opportunistic cleanup (non-blocking)
        cleanupExpiredSessions().catch(() => {});

        switch (action) {
            case 'start': {
                const { uploadId, fileName, totalChunks, generateEmbeddings } = body;

                if (!uploadId || typeof uploadId !== 'string' || uploadId.length > 100) {
                    return NextResponse.json({ error: 'Invalid uploadId' }, { status: 400 });
                }
                if (!Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > MAX_CHUNKS) {
                    return NextResponse.json({
                        error: `totalChunks must be between 1 and ${MAX_CHUNKS}`
                    }, { status: 400 });
                }

                const id = safeId(uploadId);
                const safeName = (fileName || 'upload.csv').slice(0, 255);
                const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

                const [inserted] = await prisma.$queryRaw<[{ id: string }?]>`
                    INSERT INTO public.upload_sessions (id, file_name, total_chunks, generate_embeddings, expires_at)
                    VALUES (${id}, ${safeName}, ${totalChunks}, ${generateEmbeddings ?? true}, ${expiresAt})
                    ON CONFLICT (id) DO NOTHING
                    RETURNING id
                `;
                if (!inserted) {
                    return NextResponse.json({ error: 'Upload session already exists' }, { status: 409 });
                }

                return NextResponse.json({ success: true, uploadId: id });
            }

            case 'chunk': {
                const { uploadId, chunkIndex, content } = body;

                if (!uploadId || typeof uploadId !== 'string') {
                    return NextResponse.json({ error: 'Invalid uploadId' }, { status: 400 });
                }
                if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
                    return NextResponse.json({ error: 'Invalid chunkIndex' }, { status: 400 });
                }
                if (typeof content !== 'string') {
                    return NextResponse.json({ error: 'Content must be a string' }, { status: 400 });
                }
                if (content.length > MAX_CHUNK_SIZE) {
                    return NextResponse.json({
                        error: `Chunk size exceeds maximum of ${MAX_CHUNK_SIZE / 1024 / 1024}MB`
                    }, { status: 400 });
                }

                const id = safeId(uploadId);

                const [session] = await prisma.$queryRaw<Array<{ total_chunks: number; expires_at: Date }>>`
                    SELECT total_chunks, expires_at FROM public.upload_sessions WHERE id = ${id}
                `;

                if (!session) {
                    return NextResponse.json({ error: 'Upload session not found' }, { status: 404 });
                }
                if (new Date() > session.expires_at) {
                    await prisma.$executeRaw`DELETE FROM public.upload_sessions WHERE id = ${id}`;
                    return NextResponse.json({ error: 'Upload session expired' }, { status: 410 });
                }
                if (chunkIndex >= session.total_chunks) {
                    return NextResponse.json({
                        error: `chunkIndex ${chunkIndex} exceeds totalChunks ${session.total_chunks}`
                    }, { status: 400 });
                }

                // Upsert chunk (idempotent — safe to retry)
                await prisma.$executeRaw`
                    INSERT INTO public.upload_chunks (session_id, chunk_index, content)
                    VALUES (${id}, ${chunkIndex}, ${content})
                    ON CONFLICT (session_id, chunk_index) DO UPDATE SET content = EXCLUDED.content
                `;

                // Extend TTL on each chunk received
                const newExpiry = new Date(Date.now() + SESSION_TTL_MS);
                await prisma.$executeRaw`
                    UPDATE public.upload_sessions SET expires_at = ${newExpiry} WHERE id = ${id}
                `;

                const [{ chunk_count }] = await prisma.$queryRaw<[{ chunk_count: bigint }]>`
                    SELECT COUNT(*) AS chunk_count FROM public.upload_chunks WHERE session_id = ${id}
                `;

                return NextResponse.json({
                    success: true,
                    receivedChunk: chunkIndex,
                    totalReceived: Number(chunk_count),
                    totalExpected: session.total_chunks
                });
            }

            case 'complete': {
                const { uploadId } = body;

                if (!uploadId || typeof uploadId !== 'string') {
                    return NextResponse.json({ error: 'Invalid uploadId' }, { status: 400 });
                }

                const id = safeId(uploadId);

                const [session] = await prisma.$queryRaw<Array<{
                    file_name: string;
                    total_chunks: number;
                    generate_embeddings: boolean;
                    expires_at: Date;
                }>>`
                    SELECT file_name, total_chunks, generate_embeddings, expires_at
                    FROM public.upload_sessions WHERE id = ${id}
                `;

                if (!session) {
                    return NextResponse.json({ error: 'Upload session not found' }, { status: 404 });
                }
                if (new Date() > session.expires_at) {
                    await prisma.$executeRaw`DELETE FROM public.upload_sessions WHERE id = ${id}`;
                    return NextResponse.json({ error: 'Upload session expired' }, { status: 410 });
                }

                // Validate all chunks are present — fetch only chunk_index to avoid loading content
                const receivedIndexes = await prisma.$queryRaw<Array<{ chunk_index: number }>>`
                    SELECT chunk_index FROM public.upload_chunks
                    WHERE session_id = ${id}
                    ORDER BY chunk_index ASC
                `;

                if (receivedIndexes.length !== session.total_chunks) {
                    const received = receivedIndexes.map(c => c.chunk_index);
                    const missing: number[] = [];
                    for (let i = 0; i < session.total_chunks; i++) {
                        if (!received.includes(i)) missing.push(i);
                    }
                    return NextResponse.json({
                        error: `Missing chunks: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '...' : ''}`,
                        received: receivedIndexes.length,
                        expected: session.total_chunks
                    }, { status: 400 });
                }

                // Validate total size using a DB-side SUM — avoids loading any content into memory
                const [{ total_size }] = await prisma.$queryRaw<[{ total_size: bigint }]>`
                    SELECT COALESCE(SUM(LENGTH(content)), 0) AS total_size
                    FROM public.upload_chunks WHERE session_id = ${id}
                `;
                if (Number(total_size) > MAX_TOTAL_SIZE) {
                    await prisma.$executeRaw`DELETE FROM public.upload_sessions WHERE id = ${id}`;
                    return NextResponse.json({
                        error: `Total file size exceeds maximum of ${MAX_TOTAL_SIZE / 1024 / 1024}MB`
                    }, { status: 400 });
                }

                // Pass a session reference to the ingestion pipeline — chunks are streamed
                // directly from the database during processing, never assembled into a single string.
                // The session is deleted by the processor after all chunks have been consumed.
                // Processing is triggered by the Supabase DB webhook on ingest_jobs INSERT.
                const { jobId } = await startBackgroundIngestFromSession(id, session.total_chunks, {
                    source: `csv:${session.file_name}`,
                    filterKeywords: undefined,
                    generateEmbeddings: session.generate_embeddings,
                });

                return NextResponse.json({
                    message: 'Ingestion started in the background.',
                    jobId
                });
            }

            default:
                return NextResponse.json({ error: 'Invalid action. Use: start, chunk, complete' }, { status: 400 });
        }
    } catch (error: unknown) {
        console.error('Chunked CSV Ingestion Error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
