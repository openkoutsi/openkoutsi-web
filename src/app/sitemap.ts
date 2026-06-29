import type { MetadataRoute } from 'next'

// Rendered at request time so the URLs reflect the BASE_URL configured for this
// deployment rather than a value baked in at build time.
export const dynamic = 'force-dynamic'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.BASE_URL ?? ''
  const lastModified = new Date()
  const languages = { en: `${base}/en`, fi: `${base}/fi` }

  return [
    {
      url: `${base}/en`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 1,
      alternates: { languages },
    },
    {
      url: `${base}/fi`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 1,
      alternates: { languages },
    },
  ]
}
