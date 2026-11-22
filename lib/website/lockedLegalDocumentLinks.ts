import type { PublicContractLegal, PublicLegalRequirement } from '@/lib/website/publicContractContract'

function documentUrl(value: string | null, origin: string | null, kind: string, versionId: string): string | null {
  const input = value?.trim()
  if (!input || /[\\\s]/.test(input)) return null

  const relative = input.startsWith('/')
  if (relative ? !origin || !input.startsWith('/legal/') : !/^https:\/\//i.test(input)) return null
  try {
    const url = new URL(input, relative ? origin ?? undefined : undefined)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    if (relative || (url.origin === origin && url.pathname.startsWith('/legal/'))) {
      const match = /^\/legal\/[^/]+\/([^/]+)\/([^/]+)$/.exec(url.pathname)
      const segment = kind === 'privacy_policy' ? 'privacy' : kind.replaceAll('_', '-')
      if (url.origin !== origin || !match || match[1] !== segment || decodeURIComponent(match[2]) !== versionId) return null
    }
    return url.href
  } catch {
    return null
  }
}

export function lockedLegalDocumentLinks(
  legal: PublicContractLegal,
  requirement: PublicLegalRequirement,
  origin: string | null,
): string[] {
  const bundleId = legal.legal_bundle_version_id
  if (!bundleId || bundleId !== requirement.legal_bundle_version_id) return []
  const combined = documentUrl(requirement.public_url, origin, requirement.document_type, bundleId)
  if (combined) return [combined]

  const links: string[] = []
  for (const id of requirement.source_document_ids) {
    const source = legal.module_versions.find((module) => module.id === id)
    if (!source || source.legal_bundle_version_id !== bundleId || !requirement.module_keys.includes(source.module_key)) return []
    const link = documentUrl(source.url, origin, source.module_key, id)
    if (!link) return []
    links.push(link)
  }
  return [...new Set(links)]
}
