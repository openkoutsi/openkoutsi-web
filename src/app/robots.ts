import type { MetadataRoute } from 'next'

// Rendered at request time so the sitemap URL reflects the BASE_URL configured
// for this deployment rather than a value baked in at build time.
export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
  const base = process.env.BASE_URL ?? ''
  const result: MetadataRoute.Robots = {
    rules: [
      {
        userAgent: '*',
        allow: ['/en', '/fi'],
        disallow: ['/', '/setup'],
      },
    ],
  }
  if (base) {
    result.sitemap = `${base}/sitemap.xml`
  }
  return result
}
