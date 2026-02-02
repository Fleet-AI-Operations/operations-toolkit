import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user email from profile
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { email: true }
    })

    const body = await request.json()
    const { pageUrl, description, userAgent } = body

    if (!pageUrl || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: pageUrl, description' },
        { status: 400 }
      )
    }

    // Validate input types and lengths
    if (typeof description !== 'string' || description.length > 10000) {
      return NextResponse.json(
        { error: 'Description must be a string under 10000 characters' },
        { status: 400 }
      )
    }

    if (typeof pageUrl !== 'string' || pageUrl.length > 2000) {
      return NextResponse.json(
        { error: 'Page URL must be a string under 2000 characters' },
        { status: 400 }
      )
    }

    if (userAgent && typeof userAgent !== 'string') {
      return NextResponse.json(
        { error: 'User agent must be a string' },
        { status: 400 }
      )
    }

    // Create the bug report
    const bugReport = await prisma.bugReport.create({
      data: {
        userId: user.id,
        userEmail: profile?.email || user.email || 'unknown',
        pageUrl,
        userAgent: userAgent || null,
        description,
      },
    })

    return NextResponse.json({
      success: true,
      id: bugReport.id,
    })
  } catch (error) {
    console.error('Error creating bug report:', error)
    return NextResponse.json(
      { error: 'Failed to create bug report' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { role: true }
    })

    const isAdmin = profile?.role === 'ADMIN'

    // Fetch bug reports (all for admins, own for others)
    const bugReports = await prisma.bugReport.findMany({
      where: isAdmin ? {} : { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to 100 most recent reports
    })

    return NextResponse.json({ bugReports })
  } catch (error) {
    console.error('Error fetching bug reports:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bug reports' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { role: true, email: true }
    })

    if (profile?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, status, assignedTo } = body

    if (!id || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: id, status' },
        { status: 400 }
      )
    }

    // Validate status
    if (!['PENDING', 'IN_PROGRESS', 'RESOLVED'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be PENDING, IN_PROGRESS, or RESOLVED' },
        { status: 400 }
      )
    }

    // Update the bug report
    const updateData: Prisma.BugReportUncheckedUpdateInput = {
      status,
    }

    // Only update assignment if explicitly provided
    if (assignedTo !== undefined) {
      updateData.assignedTo = assignedTo === 'self' ? user.id : null
      updateData.assignedToEmail = assignedTo === 'self' ? (profile?.email ?? null) : null
    }

    const bugReport = await prisma.bugReport.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      bugReport,
    })
  } catch (error) {
    console.error('Error updating bug report:', error)
    return NextResponse.json(
      {
        error: 'Failed to update bug report',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
