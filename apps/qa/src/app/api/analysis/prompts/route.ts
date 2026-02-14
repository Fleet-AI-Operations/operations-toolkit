/**
 * Prompts List API
 *
 * Fetches all task prompts for a project along with their creators.
 * Used by the prompt comparison and analysis features.
 *
 * GET /api/analysis/prompts?projectId={id}
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';

export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = req.nextUrl.searchParams.get('projectId');
    if (!projectId) {
        return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Fetch prompts from database
    let prompts;
    try {
        prompts = await prisma.dataRecord.findMany({
            where: {
                projectId,
                type: 'TASK'
            },
            select: {
                id: true,
                content: true,
                category: true,
                metadata: true,
                createdById: true,
                createdByEmail: true,
                createdByName: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' }
        });
    } catch (dbError: any) {
        console.error('Prompts API Error: Database query failed', {
            projectId,
            error: dbError.message
        });
        return NextResponse.json({
            error: 'Failed to fetch prompts from database. Please try again.'
        }, { status: 500 });
    }

    // Process user list
    try {
        // Get unique user IDs who have created prompts
        const uniqueUserIds = Array.from(new Set(prompts.map(p => p.createdById).filter(Boolean))) as string[];

        // Fetch profiles from database to get firstName and lastName for sorting
        const profiles = await prisma.profile.findMany({
            where: {
                id: { in: uniqueUserIds }
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
            }
        });

        // Create user list with proper names and sort by lastName, then firstName
        const users = uniqueUserIds
            .map(id => {
                const profile = profiles.find(p => p.id === id);
                const prompt = prompts.find(p => p.createdById === id);

                let displayName = 'Unknown User';
                let lastName: string | null = profile?.lastName || null;
                let firstName: string | null = profile?.firstName || null;

                // Build display name from firstName and lastName if available
                if (profile?.firstName && profile?.lastName) {
                    displayName = `${profile.firstName} ${profile.lastName}`;
                } else if (profile?.firstName) {
                    displayName = profile.firstName;
                } else if (profile?.lastName) {
                    displayName = profile.lastName;
                } else if (profile?.email) {
                    displayName = profile.email;
                } else if (prompt?.createdByName) {
                    displayName = prompt.createdByName;
                } else if (prompt?.createdByEmail) {
                    displayName = prompt.createdByEmail;
                }

                // If no lastName from profile, try to parse from display name
                // Assumes format "FirstName LastName"
                if (!lastName && displayName && displayName !== 'Unknown User' && !displayName.includes('@')) {
                    const nameParts = displayName.trim().split(/\s+/);
                    if (nameParts.length >= 2) {
                        // Take the last part as last name
                        lastName = nameParts[nameParts.length - 1];
                        // Everything before the last part is first name
                        firstName = nameParts.slice(0, -1).join(' ');
                    }
                }

                return {
                    id,
                    name: displayName,
                    lastName,
                    firstName
                };
            })
            .sort((a, b) => {
                // Put users without last names at the end
                if (!a.lastName && !b.lastName) {
                    // Both have no last name, sort by display name
                    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
                }
                if (!a.lastName) return 1; // a goes to end
                if (!b.lastName) return -1; // b goes to end

                // Both have last names, sort by lastName then firstName (case-insensitive)
                const lastNameCompare = a.lastName.localeCompare(b.lastName, undefined, { sensitivity: 'base' });
                if (lastNameCompare !== 0) return lastNameCompare;

                // If last names are equal, sort by first name
                if (a.firstName && b.firstName) {
                    return a.firstName.localeCompare(b.firstName, undefined, { sensitivity: 'base' });
                }
                if (!a.firstName) return 1;
                if (!b.firstName) return -1;
                return 0;
            })
            .map(({ id, name }) => ({ id, name })); // Remove sorting fields from final output

        console.log('Prompts API: Fetched prompts successfully', {
            projectId,
            userId: user.id,
            promptCount: prompts.length,
            userCount: users.length
        });

        return NextResponse.json({ prompts, users });
    } catch (error: any) {
        console.error('Prompts API Error: Unexpected error during processing', {
            projectId,
            error: error.message,
            stack: error.stack
        });
        return NextResponse.json({
            error: 'An unexpected error occurred while processing prompts'
        }, { status: 500 });
    }
}
