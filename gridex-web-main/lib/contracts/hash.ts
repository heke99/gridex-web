import crypto from 'crypto'

export function hashDocument(content: string): string {
  return crypto
    .createHash('sha256')
    .update(content)
    .digest('hex')
}