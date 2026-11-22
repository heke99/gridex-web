import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type {
  WebsitePricingPreview,
  WebsitePricingQuoteContext,
} from '@/lib/website/publicApi'
import type { WebsiteCustomerType } from '@/lib/website/customerType'
import type { QuoteVerificationReceipt } from '@/lib/website/canonicalQuoteValidation'

export type WebsiteCheckoutContext = {
  customerType: WebsiteCustomerType
  selectedOffer: string
  pricingPreview: WebsitePricingPreview
  quoteContext: WebsitePricingQuoteContext
}

type StoredRow = { public_context: WebsiteCheckoutContext; expires_at: string }
const CHECKOUT_HANDOFF_TTL_MS = 24 * 60 * 60_000

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) throw new Error('Website checkout context storage is not configured.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createWebsiteCheckoutContext(
  context: WebsiteCheckoutContext,
  verification: QuoteVerificationReceipt,
): Promise<string> {
  const client = serviceClient()
  const token = randomBytes(32).toString('base64url')
  const now = Date.now()
  // This is only a technical handoff-token retention window. It is deliberately
  // independent from quote validity; the canonical quote remains verifiable in OPS.
  const expiresAt = new Date(now + CHECKOUT_HANDOFF_TTL_MS).toISOString()

  const { error } = await client.from('website_checkout_contexts').insert({
    token_hash: tokenHash(token),
    public_context: { ...context, verification },
    expires_at: expiresAt,
  })
  if (error) throw new Error(`Website checkout context storage failed: ${error.message}`)
  return token
}

export async function cleanupExpiredWebsiteCheckoutContexts(): Promise<void> {
  const { error } = await serviceClient()
    .from('website_checkout_contexts')
    .delete()
    .lte('expires_at', new Date().toISOString())
  if (error) throw new Error('Website checkout context cleanup failed.')
}

export async function readWebsiteCheckoutContext(
  token: string | null | undefined,
): Promise<WebsiteCheckoutContext | null> {
  const normalized = token?.trim() ?? ''
  if (!/^[A-Za-z0-9_-]{32,160}$/.test(normalized)) return null
  const { data, error } = await serviceClient()
    .from('website_checkout_contexts')
    .select('public_context,expires_at')
    .eq('token_hash', tokenHash(normalized))
    .gt('expires_at', new Date().toISOString())
    .maybeSingle<StoredRow>()
  if (error) throw new Error(`Website checkout context read failed: ${error.message}`)
  if (!data?.public_context) return null
  const { customerType, selectedOffer, pricingPreview, quoteContext } = data.public_context
  return { customerType, selectedOffer, pricingPreview, quoteContext }
}
