import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

const intlMiddleware = createMiddleware(routing)

// Locale-relative path prefixes that require an authenticated session
const PROTECTED_PREFIXES = [
  '/dashboard', '/activities', '/power', '/records',
  '/goals', '/plan', '/profile', '/settings', '/admin',
  '/workouts', '/inbox', '/onboarding',
]

// Public auth-page prefixes
const AUTH_PREFIXES = ['/login', '/register', '/reset-password']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    /\.[\w]+$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  const locales = routing.locales as readonly string[]
  let logicalPath = pathname
  let detectedLocale: string = routing.defaultLocale
  for (const locale of locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      logicalPath = pathname.slice(locale.length + 1) || '/'
      detectedLocale = locale
      break
    }
  }

  const hasSession = request.cookies.has('session')

  // Gate authenticated app pages; public auth pages are excluded.
  const isAuthPage = AUTH_PREFIXES.some((s) => logicalPath.startsWith(s))
  const isProtected = PROTECTED_PREFIXES.some((s) => logicalPath.startsWith(s))
  if (isProtected && !isAuthPage && !hasSession) {
    const loginUrl = new URL(`/${detectedLocale}/login`, request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.\\w+$).*)'],
}
