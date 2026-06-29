import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

const intlMiddleware = createMiddleware(routing)

// Build the Content-Security-Policy at request time so it reflects the backend
// API origin configured at runtime (the API_URL env var). It lives here rather
// than in next.config because next.config `headers()` is evaluated at build time
// and baked into the build, so it cannot pick up a runtime value.
function buildCsp(): string {
  const apiUrl = process.env.API_URL ?? 'http://localhost:8000'
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline for hydration scripts and unsafe-eval in dev mode
    "style-src 'self' 'unsafe-inline'", // 'unsafe-inline' required by Tailwind CSS
    `connect-src 'self' ${apiUrl}`,
    `img-src 'self' data: https: ${apiUrl}`,
    "font-src 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

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

  const csp = buildCsp()

  // Gate authenticated app pages; public auth pages are excluded.
  const isAuthPage = AUTH_PREFIXES.some((s) => logicalPath.startsWith(s))
  const isProtected = PROTECTED_PREFIXES.some((s) => logicalPath.startsWith(s))
  if (isProtected && !isAuthPage && !hasSession) {
    const loginUrl = new URL(`/${detectedLocale}/login`, request.url)
    loginUrl.searchParams.set('next', pathname)
    const redirectResponse = NextResponse.redirect(loginUrl)
    redirectResponse.headers.set('Content-Security-Policy', csp)
    return redirectResponse
  }

  const response = intlMiddleware(request)
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.\\w+$).*)'],
}
