import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/content'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/',
          '/admin/*',
          '/api',
          '/api/',
          '/api/*',
          '/auth',
          '/auth/',
          '/auth/*',
          '/dashboard',
          '/dashboard/',
          '/dashboard/*',
          '/login',
          '/login/',
          '/login/*',
          '/logout',
          '/mina-sidor',
          '/register',
          '/register/',
          '/register/*',
          '/sign',
          '/sign/',
          '/sign/*',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
