import type { MetadataRoute } from 'next'
import { SITE_URL, canonicalPublicRoutes, elavtalPages, elprisPages, guidePages, glossaryPages, marketPages } from '@/lib/seo/content'

const LAST_MODIFIED_BY_ROUTE: Record<string, string> = {
  '/': '2026-10-07',
  '/elavtal/billigt-elavtal': '2026-10-07',
  '/elavtal/jamfor-elavtal': '2026-10-07',
  '/elavtal/byta-elbolag': '2026-10-07',
  '/elbolag/byta-fran-annat-elbolag': '2026-10-07',
  '/elbolag': '2026-10-07',
  '/elavtal': '2026-06-24',
  '/elpriser': '2026-06-24',
  '/elpriser/elpris-idag': '2026-06-24',
  '/guider': '2026-06-24',
  '/teckna-avtal': '2026-06-17',
  '/kundservice': '2026-06-17',
  '/vanliga-fragor': '2026-07-18',
  '/integritetspolicy': '2026-06-12',
  '/allmanna-villkor': '2026-06-12',
  '/angerratt': '2026-06-12',
  '/prisvillkor': '2026-06-12',
  '/fullmakt': '2026-06-12',
  '/cookies': '2026-06-12',
  '/angerblankett': '2026-06-12',
  '/foretagsvillkor': '2026-06-12',
}

function frequency(path: string): MetadataRoute.Sitemap[number]['changeFrequency'] {
  if (path === '/' || path === '/elpriser/elpris-idag') return 'daily'
  if (path.startsWith('/elpriser')) return 'daily'
  if (path.startsWith('/elavtal') || path.startsWith('/guider')) return 'weekly'
  if (path.startsWith('/ordlista') || path.startsWith('/elbolag') || path.startsWith('/elhandlare') || path.startsWith('/natagare')) return 'monthly'
  return 'monthly'
}

function priority(path: string) {
  if (path === '/') return 1
  if (path === '/elavtal' || path === '/elpriser/elpris-idag') return 0.95
  if (path.startsWith('/elavtal') || path.startsWith('/elpriser')) return 0.86
  if (path.startsWith('/guider')) return 0.78
  if (path.startsWith('/ordlista')) return 0.62
  if (path.startsWith('/elbolag') || path.startsWith('/elhandlare') || path.startsWith('/natagare')) return 0.68
  if (path === '/sitemap') return 0.5
  if (path === '/teckna-avtal') return 0.72
  return 0.45
}

export default function sitemap(): MetadataRoute.Sitemap {
  const contentDates = new Map(
    [...elavtalPages, ...elprisPages, ...guidePages, ...glossaryPages, ...marketPages]
      .filter((page) => page.lastModified)
      .map((page) => [page.path, page.lastModified!] as const),
  )
  return canonicalPublicRoutes.map((path) => ({
    url: `${SITE_URL}${path === '/' ? '' : path}`,
    lastModified: contentDates.get(path) ?? (LAST_MODIFIED_BY_ROUTE[path]
      ? new Date(`${LAST_MODIFIED_BY_ROUTE[path]}T00:00:00.000Z`)
      : undefined),
    changeFrequency: frequency(path),
    priority: priority(path),
  }))
}
