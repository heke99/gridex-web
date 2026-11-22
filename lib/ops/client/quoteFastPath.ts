import { canonicalSha256 } from '@/lib/ops/canonicalJson'
import { OpsError } from '@/lib/ops/errors'
import {
  assertWebsiteOperationRequest,
  assertWebsiteOperationResponse,
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
  opsRequest,
  recordValue,
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
  signal?: AbortSignal,
): Promise<OpsWebsitePricingPreview> {
  signal?.throwIfAborted()
  await getVerifiedOpsIntegrationContext()
  signal?.throwIfAborted()
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
  const earliest = input.requested_start_mode === "earliest_possible";
  const requestHeaders = new Headers({
    ...(earliest ? { Prefer: "earliest-switch-start" } : {}),
    "Idempotency-Key": [earliest ? "website-earliest-quote" : "website-quote", input.quote_attempt_id, canonicalSha256(requestBody)].join(":"),
  });
  assertWebsiteOperationRequest(endpoint, "post", requestBody, requestHeaders);
  const { payload, headers, status } = await opsRequest(endpoint, {
    method: 'POST',
    signal,
    headers: requestHeaders,
    body: JSON.stringify(requestBody),
  })
  observeRuntimeSchemaValidation({
    endpoint,
    schema: 'WebsiteQuoteResponse',
    validate: () => {
      assertWebsiteOperationResponse(endpoint, 'post', status, payload)
      assertWebsiteResponse('WebsiteQuoteResponse', payload, endpoint)
    },
  })
  await verifiedOrganizationReference(payload, endpoint)

  if (earliest && headers.get('Preference-Applied') !== 'earliest-switch-start') {
    throw new OpsError('Tidigaste startdatum kunde inte verifieras just nu.', 503, {
      code: 'ops_quote_start_policy_unavailable', endpoint, retryable: true,
    })
  }
  const quoteStart = earliest ? normalizeText(recordValue(extractQuoteRow(payload).input)?.start_date) : input.start_date
  if (!quoteStart) {
    throw new OpsError('OPS-offerten saknar startdatum.', 502, { code: 'ops_quote_start_date_missing', endpoint })
  }

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
    start_date: quoteStart,
    price_option_reference: selectedPriceOptionReference,
  })
}
