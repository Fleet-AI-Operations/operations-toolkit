import { NextRequest, NextResponse } from 'next/server';
import { startBackgroundIngest } from '@/lib/ingestion';
import { RecordType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { writeFile, readFile, mkdir, rm, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Security limits
const MAX_CHUNKS = 100;
const MAX_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB per chunk
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB total
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Use OS temp directory (works on Vercel, local dev, etc.)
const UPLOAD_DIR = path.join(os.tmpdir(), 'csv-uploads');

async function ensureUploadDir(): Promise<void> {
    if (!existsSync(UPLOAD_DIR)) {
        await mkdir(UPLOAD_DIR, { recursive: true });
    }
}

async function getSessionDir(uploadId: string): Promise<string> {
    // Sanitize uploadId to prevent path traversal
    const safeId = uploadId.replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(UPLOAD_DIR, safeId);
}

async function cleanupExpiredSessions(): Promise<void> {
    try {
        if (!existsSync(UPLOAD_DIR)) return;

        const sessions = await readdir(UPLOAD_DIR);
        const now = Date.now();

        for (const sessionId of sessions) {
            const sessionDir = path.join(UPLOAD_DIR, sessionId);
            const metaPath = path.join(sessionDir, 'meta.json');

            try {
                if (existsSync(metaPath)) {
                    const meta = JSON.parse(await readFile(metaPath, 'utf-8'));
                    if (now > meta.expiresAt) {
                        await rm(sessionDir, { recursive: true, force: true });
                    }
                }
            } catch {
                // If we can't read meta, session is corrupted - clean it up
                await rm(sessionDir, { recursive: true, force: true }).catch(() => {});
            }
        }
    } catch {
        // Ignore cleanup errors
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action } = body;

        // Opportunistic cleanup (non-blocking)
        cleanupExpiredSessions().catch(() => {});

        switch (action) {
            case 'start': {
                const { uploadId, projectId, type, fileName, totalChunks, generateEmbeddings } = body;

                // Validation
                if (!uploadId || typeof uploadId !== 'string' || uploadId.length > 100) {
                    return NextResponse.json({ error: 'Invalid uploadId' }, { status: 400 });
                }
                if (!projectId || typeof projectId !== 'string') {
                    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
                }
                if (!type || !['TASK', 'FEEDBACK'].includes(type)) {
                    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
                }
                if (!Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > MAX_CHUNKS) {
                    return NextResponse.json({
                        error: `totalChunks must be between 1 and ${MAX_CHUNKS}`
                    }, { status: 400 });
                }

                // Verify project exists
                const project = await prisma.project.findUnique({
                    where: { id: projectId },
                    select: { id: true }
                });
                if (!project) {
                    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
                }

                await ensureUploadDir();
                const sessionDir = await getSessionDir(uploadId);

                // Check if session already exists
                if (existsSync(sessionDir)) {
                    return NextResponse.json({ error: 'Upload session already exists' }, { status: 409 });
                }

                // Create session directory and metadata
                await mkdir(sessionDir, { recursive: true });
                const meta = {
                    projectId,
                    type,
                    fileName: (fileName || 'upload.csv').slice(0, 255),
                    totalChunks,
                    generateEmbeddings: generateEmbeddings ?? true,
                    expiresAt: Date.now() + SESSION_TTL_MS,
                    createdAt: Date.now()
                };
                await writeFile(path.join(sessionDir, 'meta.json'), JSON.stringify(meta));

                return NextResponse.json({ success: true, uploadId });
            }

            case 'chunk': {
                const { uploadId, chunkIndex, content } = body;

                // Validation
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

                const sessionDir = await getSessionDir(uploadId);
                const metaPath = path.join(sessionDir, 'meta.json');

                if (!existsSync(metaPath)) {
                    return NextResponse.json({ error: 'Upload session not found' }, { status: 404 });
                }

                const meta = JSON.parse(await readFile(metaPath, 'utf-8'));

                // Check expiration
                if (Date.now() > meta.expiresAt) {
                    await rm(sessionDir, { recursive: true, force: true });
                    return NextResponse.json({ error: 'Upload session expired' }, { status: 410 });
                }

                // Validate chunk index
                if (chunkIndex >= meta.totalChunks) {
                    return NextResponse.json({
                        error: `chunkIndex ${chunkIndex} exceeds totalChunks ${meta.totalChunks}`
                    }, { status: 400 });
                }

                // Write chunk to file
                const chunkPath = path.join(sessionDir, `chunk_${String(chunkIndex).padStart(5, '0')}`);
                await writeFile(chunkPath, content, 'utf-8');

                // Extend expiration
                meta.expiresAt = Date.now() + SESSION_TTL_MS;
                await writeFile(metaPath, JSON.stringify(meta));

                // Count received chunks
                const files = await readdir(sessionDir);
                const chunkCount = files.filter(f => f.startsWith('chunk_')).length;

                return NextResponse.json({
                    success: true,
                    receivedChunk: chunkIndex,
                    totalReceived: chunkCount,
                    totalExpected: meta.totalChunks
                });
            }

            case 'complete': {
                const { uploadId } = body;

                if (!uploadId || typeof uploadId !== 'string') {
                    return NextResponse.json({ error: 'Invalid uploadId' }, { status: 400 });
                }

                const sessionDir = await getSessionDir(uploadId);
                const metaPath = path.join(sessionDir, 'meta.json');

                if (!existsSync(metaPath)) {
                    return NextResponse.json({ error: 'Upload session not found' }, { status: 404 });
                }

                const meta = JSON.parse(await readFile(metaPath, 'utf-8'));

                // Get all chunk files sorted by index
                const files = await readdir(sessionDir);
                const chunkFiles = files.filter(f => f.startsWith('chunk_')).sort((a, b) => {
                    const aIndex = parseInt(a.replace('chunk_', ''), 10);
                    const bIndex = parseInt(b.replace('chunk_', ''), 10);
                    return aIndex - bIndex;
                });

                // Verify all chunks received
                if (chunkFiles.length !== meta.totalChunks) {
                    const received = chunkFiles.map(f => parseInt(f.replace('chunk_', ''), 10));
                    const missing: number[] = [];
                    for (let i = 0; i < meta.totalChunks; i++) {
                        if (!received.includes(i)) missing.push(i);
                    }
                    return NextResponse.json({
                        error: `Missing chunks: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '...' : ''}`,
                        received: chunkFiles.length,
                        expected: meta.totalChunks
                    }, { status: 400 });
                }

                // Read and combine all chunks
                const chunks: string[] = [];
                let totalSize = 0;

                for (const chunkFile of chunkFiles) {
                    const content = await readFile(path.join(sessionDir, chunkFile), 'utf-8');
                    totalSize += content.length;

                    if (totalSize > MAX_TOTAL_SIZE) {
                        await rm(sessionDir, { recursive: true, force: true });
                        return NextResponse.json({
                            error: `Total file size exceeds maximum of ${MAX_TOTAL_SIZE / 1024 / 1024}MB`
                        }, { status: 400 });
                    }

                    chunks.push(content);
                }

                const csvContent = chunks.join('');

                // Start background ingestion (fire-and-forget)
                const jobId = await startBackgroundIngest('CSV', csvContent, {
                    projectId: meta.projectId,
                    source: `csv:${meta.fileName}`,
                    type: meta.type as RecordType,
                    filterKeywords: undefined,
                    generateEmbeddings: meta.generateEmbeddings,
                });

                // Cleanup session directory (non-blocking)
                rm(sessionDir, { recursive: true, force: true }).catch(() => {});

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
