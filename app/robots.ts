import type { MetadataRoute } from 'next'

const SITE_URL = 'https://gridex.se'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        // Allow all public pages by default
        allow: '/',
        // Disallow admin and private/auth pages from indexing
        disallow: [
          '/admin',
          '/login',
          '/register',
          '/login/forgot-password',
          '/login/reset-password',
          '/dashboard',
          '/dashboard/',
          '/dashboard/*',
          '/mina-sidor',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}