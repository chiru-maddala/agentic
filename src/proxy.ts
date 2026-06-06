import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'chirans@gmail.com'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const isPublicPage = pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/share')
  const isAuthApi = pathname.startsWith('/api/auth')
  const isShareApi = pathname.startsWith('/api/share')
  const isApi = pathname.startsWith('/api')
  const isPending = pathname === '/pending'
  const isAdmin = pathname.startsWith('/admin')

  // Auth API routes and share API are always public
  if (isAuthApi || isShareApi) return supabaseResponse

  // Unauthenticated users can only access public pages
  if (!user) {
    if (isPublicPage) return supabaseResponse
    if (isApi) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Authenticated users: redirect away from login/register
  if (isPublicPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const isAdminUser = user.email === ADMIN_EMAIL

  // Admin route: only for admin
  if (isAdmin && !isAdminUser) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Pending page is accessible to everyone authenticated
  if (isPending) return supabaseResponse

  // Non-admin users: check approval
  if (!isAdminUser) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('approved')
      .eq('id', user.id)
      .single()

    if (!profile?.approved) {
      if (isApi) return Response.json({ error: 'Account pending approval' }, { status: 403 })
      return NextResponse.redirect(new URL('/pending', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
