const INTERNAL_REDIRECT_ORIGIN = 'https://gridex.invalid'
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/

/**
 * Accepts only same-origin application paths. Backslashes are rejected because
 * URL parsers may normalize `/\\host` into a protocol-relative redirect.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback = '/mina-sidor',
): string {
  const normalized = value?.trim() ?? ''
  if (!normalized.startsWith('/') || normalized.startsWith('//')) return fallback
  if (normalized.includes('\\') || CONTROL_CHARACTER_PATTERN.test(normalized)) return fallback

  try {
    const parsed = new URL(normalized, INTERNAL_REDIRECT_ORIGIN)
    if (parsed.origin !== INTERNAL_REDIRECT_ORIGIN) return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}
