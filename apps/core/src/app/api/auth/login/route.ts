import { createClient } from '@repo/auth/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error('[Login] Authentication failed:', error.message)
    return NextResponse.json(
      { error: error.message },
      { status: 401 }
    )
  }

  // Verify session was created
  if (!data.session) {
    console.error('[Login] No session created after successful auth')
    return NextResponse.json(
      { error: 'Session creation failed' },
      { status: 500 }
    )
  }

  console.log('[Login] Auth successful, session created for:', data.user?.email)

  // Get all cookies to verify they were set
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  console.log('[Login] Cookies set:', allCookies.map(c => c.name).join(', '))

  // Return success - client will handle redirect
  return NextResponse.json({ success: true }, { status: 200 })
}
