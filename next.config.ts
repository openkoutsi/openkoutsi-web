import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

// Static security headers. The Content-Security-Policy depends on the backend
// API origin, which is configured at runtime (see getApiUrl / window.__ENV__),
// so it is set in middleware.ts instead — next.config headers are evaluated at
// build time and baked into the build, so they cannot reflect a runtime value.
const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: API_URL.startsWith('https') ? 'https' : 'http',
        hostname: new URL(API_URL).hostname,
        port: new URL(API_URL).port,
        pathname: '/api/athlete/*/avatar',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default withNextIntl(nextConfig)
