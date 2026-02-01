import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cosineSimilarity, getEmbeddings } from '@/lib/ai';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user's role
        const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { role: true }
        });

        const role = profile?.role || 'USER';

        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const selectedRecordId = searchParams.get('recordId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        if (!selectedRecordId) {
            return NextResponse.json({ error: 'recordId is required' }, { status: 400 });
        }

        // Verify project exists (read access allowed for all users)
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const selectedRecord = await prisma.dataRecord.findUnique({
            where: { id: selectedRecordId },
            select: {
                id: true,
                content: true,
                embedding: true,
                createdByEmail: true,
                createdById: true,
                createdByName: true,
            },
        });

        if (!selectedRecord) {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }

        const userId = selectedRecord.createdById;
        
        if (!userId) {
            return NextResponse.json({ error: 'Selected record has no user ID' }, { status: 400 });
        }

        let selectedEmbedding = selectedRecord.embedding;
        if (!selectedEmbedding || selectedEmbedding.length === 0) {
            const freshEmbedding = await getEmbeddings([selectedRecord.content]);
            
            if (!freshEmbedding || freshEmbedding.length === 0 || !freshEmbedding[0]) {
                return NextResponse.json({ error: 'Failed to generate embedding for selected prompt' }, { status: 500 });
            }
            
            selectedEmbedding = freshEmbedding[0];
        }

        const userRecords = await prisma.dataRecord.findMany({
            where: {
                projectId,
                type: 'TASK',
                createdById: userId,
                id: { not: selectedRecordId },
            },
            select: {
                id: true,
                content: true,
                embedding: true,
                category: true,
                source: true,
                metadata: true,
                createdAt: true,
            },
        });

        const recordsWithEmbeddings = userRecords.filter(r => r.embedding && r.embedding.length > 0);
        const recordsWithoutEmbeddings = userRecords.filter(r => !r.embedding || r.embedding.length === 0);

        if (recordsWithoutEmbeddings.length > 0) {
            try {
                const contents = recordsWithoutEmbeddings.map(r => r.content);
                const embeddings = await getEmbeddings(contents);
                
                if (embeddings && embeddings.length === contents.length) {
                    await Promise.all(
                        recordsWithoutEmbeddings.map((record, idx) =>
                            prisma.dataRecord.update({
                                where: { id: record.id },
                                data: { embedding: embeddings[idx] }
                            })
                        )
                    );

                    recordsWithoutEmbeddings.forEach((record, idx) => {
                        record.embedding = embeddings[idx];
                    });
                }
            } catch (error) {
                console.error('[Similarity] Failed to generate/save embeddings:', error);
            }
        }

        const allRecordsWithEmbeddings = recordsWithEmbeddings.concat(recordsWithoutEmbeddings);

        // Filter out records that still don't have valid embeddings after the generation attempt
        const validRecordsWithEmbeddings = allRecordsWithEmbeddings.filter(
            record => record.embedding && record.embedding.length > 0
        );

        const similarityResults = validRecordsWithEmbeddings
            .map(record => {
                const similarity = cosineSimilarity(
                    selectedEmbedding as number[],
                    record.embedding as number[]
                );

                return {
                    id: record.id,
                    content: record.content,
                    category: record.category,
                    source: record.source,
                    metadata: record.metadata,
                    createdAt: record.createdAt,
                    similarity: Math.round(similarity * 100),
                };
            })
            .sort((a, b) => b.similarity - a.similarity);

        return NextResponse.json({
            selectedRecord: {
                id: selectedRecord.id,
                content: selectedRecord.content,
                createdByEmail: selectedRecord.createdByEmail,
                createdByName: selectedRecord.createdByName,
            },
            similarPrompts: similarityResults,
        });
    } catch (error: any) {
        console.error('Error calculating similarity:', error);
        return NextResponse.json(
            { error: 'Failed to calculate similarity', details: error.message },
            { status: 500 }
        );
    }
}
