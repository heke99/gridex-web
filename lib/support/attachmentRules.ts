export const MAX_SUPPORT_ATTACHMENT_BYTES = 4 * 1024 * 1024
export const SUPPORT_ATTACHMENT_TYPES = ['application/pdf', 'image/png', 'image/jpeg'] as const
export type SupportAttachmentType = typeof SUPPORT_ATTACHMENT_TYPES[number]
export function isSupportAttachmentType(value: string): value is SupportAttachmentType {
  return (SUPPORT_ATTACHMENT_TYPES as readonly string[]).includes(value)
}
export function attachmentFileName(value: string): string {
  const clean = value.replace(/[\u0000-\u001f\u007f/\\]/g, '_').trim() || 'bilaga'
  // Both APIs cap the encoded informational filename header at 200 characters.
  let name = ''
  for (const character of clean) {
    if (encodeURIComponent(name + character).length > 200) break
    name += character
  }
  return encodeURIComponent(name || 'bilaga')
}
