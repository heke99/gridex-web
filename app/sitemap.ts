import type { MetadataRoute } from 'next'

const SITE_URL = 'https://gridex.se'

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    '',
    '/elavtal',
    '/teckna-avtal',
    // '/mina-sidor' intentionally excluded from sitemap as det inte ska indexeras
    '/kundservice',
    '/aktuella-elpriser',
    '/integritetspolicy',
    '/allmanna-villkor',
    '/angerratt',
    '/prisvillkor',
    '/fullmakt',
    '/cookies',
    '/angerblankett',
    '/foretagsvillkor',
    '/elpris-se1',
    '/elpris-se2',
    '/elpris-se3',
    '/elpris-se4',
  ]

  const now = new Date()

  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.7,
  }))
}