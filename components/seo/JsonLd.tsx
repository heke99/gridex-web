type JsonLdProps = {
  data: unknown
}

export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export function webPageJsonLd({
  name,
  description,
  url,
}: {
  name: string
  description: string
  url: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    description,
    url,
    inLanguage: 'sv-SE',
    isPartOf: {
      '@type': 'WebSite',
      name: 'Gridex AB',
      url: 'https://gridex.se',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Gridex AB',
      url: 'https://gridex.se',
    },
  }
}

export function articleJsonLd({
  headline,
  description,
  url,
  dateModified,
}: {
  headline: string
  description: string
  url: string
  dateModified: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    url,
    inLanguage: 'sv-SE',
    datePublished: '2026-06-24',
    dateModified,
    author: {
      '@type': 'Organization',
      name: 'Gridex AB',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Gridex AB',
      url: 'https://gridex.se',
    },
  }
}

export function serviceJsonLd({
  name,
  description,
  url,
}: {
  name: string
  description: string
  url: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    url,
    provider: {
      '@type': 'Organization',
      name: 'Gridex AB',
      url: 'https://gridex.se',
    },
    areaServed: {
      '@type': 'Country',
      name: 'Sweden',
    },
    serviceType: 'Elhandelsavtal',
  }
}

export function itemListJsonLd({
  name,
  items,
}: {
  name: string
  items: Array<{ name: string; url: string }>
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  }
}
