import { canonicalSha256 } from '@/lib/ops/canonicalJson'
import { OpsError } from '@/lib/ops/errors'
import {
  assertWebsiteRequest,
  assertWebsiteResponse,
} from '@/lib/ops/validators/openapi'
import { toOpsCustomerType, type WebsiteCustomerType } from '@/lib/website/customerType'

import {
  extractQuoteRow,
  getVerifiedOpsIntegrationContext,
  mapOpsWebsiteQuote,
  normalizeText,
  observeRuntimeSchemaValidation,
  opsFetch,
  verifiedOrganizationReference,
} from './core'
import type {
  OpsInvoiceDeliveryMethod,
  OpsWebsitePricingPreview,
  OpsWebsiteQuoteInput,
} from './types'

type AutoSelectedWebsiteQuoteInput = Omit<OpsWebsiteQuoteInput, 'price_option_reference'> & {
  customer_type: WebsiteCustomerType
  price_option_reference?: string | null
  invoice_delivery_method: OpsInvoiceDeliveryMethod
}

/**
 * Lets authoritative OPS select the one canonical default price option when the
 * website has not supplied one. The website still independently verifies that
 * selection against its public-contract snapshot before issuing a checkout token.
 */
export async function fetchOpsWebsiteQuoteAutoSelect(
  input: AutoSelectedWebsiteQuoteInput,
): Promise<OpsWebsitePricingPreview> {
  await getVerifiedOpsIntegrationContext()
  const requestBody = {
    resolution_id: input.resolution_id,
    offer_reference: input.offer_reference,
    annual_consumption_kwh: input.annual_consumption_kwh,
    customer_type: toOpsCustomerType(input.customer_type),
    start_date: input.start_date,
    ...(input.price_option_reference
      ? { price_option_reference: input.price_option_reference }
      : {}),
    invoice_delivery_method: input.invoice_delivery_method,
    selected_component_references: [...new Set(input.selected_component_references)],
    site_count: input.site_count,
  }
  const endpoint = '/api/v1/website/quote'
  assertWebsiteRequest('WebsiteQuoteRequest', requestBody, endpoint)
  const payload = await opsFetch(endpoint, {
    method: 'POST',
    headers: {
      'Idempotency-Key': [
        'website-quote',
        input.quote_attempt_id,
        canonicalSha256(requestBody),
      ].join(':'),
    },
    body: JSON.stringify(requestBody),
  })
  observeRuntimeSchemaValidation({
    endpoint,
    schema: 'WebsiteQuoteResponse',
    validate: () => assertWebsiteResponse('WebsiteQuoteResponse', payload, endpoint),
  })
  await verifiedOrganizationReference(payload, endpoint)

  const selectedPriceOptionReference = normalizeText(
    extractQuoteRow(payload).price_option_reference,
  )
  if (!selectedPriceOptionReference) {
    throw new OpsError('OPS-offerten saknar valt prisalternativ.', 502, {
      code: 'ops_quote_price_option_missing',
      endpoint,
      retryable: false,
    })
  }

  return mapOpsWebsiteQuote(payload, {
    ...input,
    price_option_reference: selectedPriceOptionReference,
  })
}
