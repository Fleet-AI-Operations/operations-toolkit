import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // All authenticated users can read all projects
        const projects = await prisma.project.findMany({
            orderBy: { name: 'asc' },
        });
        return NextResponse.json(projects);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
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

        // Only MANAGER and ADMIN can create projects
        if (role !== 'MANAGER' && role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden: Only managers and admins can create projects' }, { status: 403 });
        }

        const { name } = await req.json();
        const project = await prisma.project.create({
            data: {
                name,
                ownerId: user.id
            },
        });
        return NextResponse.json(project);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        // Get user's role
        const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { role: true }
        });

        const role = profile?.role || 'USER';

        // Only MANAGER and ADMIN can delete projects
        if (role !== 'MANAGER' && role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden: Only managers and admins can delete projects' }, { status: 403 });
        }

        const project = await prisma.project.findUnique({
            where: { id },
            select: { id: true }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        await prisma.project.delete({
            where: { id },
        });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id, guidelines, guidelinesFileName } = await req.json();
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        // Get user's role
        const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { role: true }
        });

        const role = profile?.role || 'USER';

        // Only MANAGER and ADMIN can update projects
        if (role !== 'MANAGER' && role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden: Only managers and admins can update projects' }, { status: 403 });
        }

        const existingProject = await prisma.project.findUnique({
            where: { id },
            select: { id: true }
        });

        if (!existingProject) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const project = await prisma.project.update({
            where: { id },
            data: {
                guidelines,
                guidelinesFileName
            },
        });
        return NextResponse.json(project);
    } catch (error: any) {
        console.error('Project PATCH Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
