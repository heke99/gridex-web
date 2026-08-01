import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { isOpsError, getOpsClientStatus } from '@/lib/ops/client'
import { GRIDEX_WEBSITE_API_VERSION_HEADER } from '@/lib/ops/contract'
import { parseWebsiteCustomerType, type WebsiteCustomerType } from '@/lib/website/customerType'
import { loadWebsitePublicContractFeed } from '@/lib/website/publicContractFeed'
import { buildPublicContractsPayload } from '@/lib/website/publicContractsPayload'

function customerType(request: Request): { value: WebsiteCustomerType | null; valid: boolean } {
  const raw = new URL(request.url).searchParams.get('customer_type')
  if (!raw) return { value: null, valid: true }
  const value = parseWebsiteCustomerType(raw)
  return value ? { value, valid: true } : { value: null, valid: false }
}

function etagMatches(request: Request, etag: string | null): boolean {
  if (!etag) return false
  return (request.headers.get('if-none-match') ?? '')
    .split(',')
    .map((value) => value.trim())
    .includes(etag)
}

function supportReference(error: unknown): string {
  if (isOpsError(error)) return error.requestId ?? error.correlationId ?? randomUUID().slice(0, 8).toUpperCase()
  return randomUUID().slice(0, 8).toUpperCase()
}

function publicError(error: unknown): { status: number; code: string; state: string; message: string } {
  if (!isOpsError(error)) {
    return {
      status: 502,
      code: 'upstream_unavailable',
      state: 'feed_failed',
      message: 'Avtalen kan inte laddas tillfälligt. Försök igen om en stund.',
    }
  }
  if (error.status === 401) return { status: 503, code: 'TENANT_API_AUTHENTICATION_FAILED', state: 'integration_not_authorized', message: 'Aktuella elavtal kan inte hämtas just nu.' }
  if (error.status === 403) return { status: 503, code: 'TENANT_API_SCOPE_MISSING', state: 'integration_not_authorized', message: 'Aktuella elavtal kan inte hämtas just nu.' }
  if (error.status === 410) return { status: 503, code: 'tenant_closed', state: 'tenant_not_operational', message: 'Inga elavtal är tillgängliga för teckning just nu.' }
  if (error.status === 423) return { status: 503, code: 'tenant_paused', state: 'tenant_not_operational', message: 'Inga elavtal är tillgängliga för teckning just nu.' }
  if (error.status === 429) return { status: 503, code: 'rate_limited', state: 'feed_failed', message: 'Avtalen kan inte laddas tillfälligt. Försök igen om en stund.' }
  if (error.code === 'ops_not_configured') {
    return { status: 503, code: 'TENANT_API_KEY_MISSING', state: 'integration_not_configured', message: 'Aktuella elavtal kan inte hämtas just nu.' }
  }
  if (error.code === 'ops_api_base_url_invalid') {
    return { status: 503, code: 'TENANT_API_CONFIGURATION_INVALID', state: 'integration_not_configured', message: 'Aktuella elavtal kan inte hämtas just nu.' }
  }
  if (error.code === 'ops_request_timeout') {
    return { status: 504, code: 'upstream_timeout', state: 'feed_failed', message: 'Avtalen kan inte laddas tillfälligt. Försök igen om en stund.' }
  }
  if (error.code === 'ops_tenant_mismatch') {
    return { status: 503, code: 'tenant_mismatch', state: 'tenant_not_operational', message: 'Aktuella elavtal kan inte hämtas just nu.' }
  }
  if (['ops_public_contracts_response_invalid', 'ops_public_contracts_contract_version_missing', 'ops_public_contracts_contract_version_mismatch', 'ops_public_contracts_publication_revision_missing'].includes(error.code ?? '')) {
    return { status: 502, code: 'UPSTREAM_CONTRACT_SCHEMA_INCOMPATIBLE', state: 'upstream_schema_incompatible', message: 'Avtalen kan inte laddas tillfälligt. Försök igen om en stund.' }
  }
  return {
    status: error.status >= 500 ? 502 : 503,
    code: error.code ?? 'invalid_response',
    state: 'feed_failed',
    message: 'Avtalen kan inte laddas tillfälligt. Försök igen om en stund.',
  }
}

export async function publicContractsResponse(request: Request) {
  const requestId = request.headers.get('x-request-id')?.trim() || randomUUID()
  const correlationId = request.headers.get('x-correlation-id')?.trim() || requestId
  const filter = customerType(request)
  if (!filter.valid) {
    return NextResponse.json(
      { error: { code: 'validation_error', message: 'customer_type måste vara private eller business.', field: 'customer_type' } },
      { status: 400 },
    )
  }

  const status = getOpsClientStatus()
  if (!status.configured) {
    const apiKeyMissing = status.missing.some((item) => item.includes('GRIDEX_API_KEY'))
    const code = apiKeyMissing ? 'TENANT_API_KEY_MISSING' : 'TENANT_API_CONFIGURATION_INVALID'
    console.error('[website public-contracts] integration configuration missing', {
      code,
      missing_environment_variables: status.missing,
      request_id: requestId,
      correlation_id: correlationId,
    })
    return NextResponse.json(
      {
        error: {
          code,
          state: 'integration_not_configured',
          message: 'Aktuella elavtal kan inte hämtas just nu.',
        },
      },
      { status: 503 },
    )
  }

  try {
    const feed = await loadWebsitePublicContractFeed({
      context: 'website public-contracts endpoint',
      customerType: filter.value,
    })
    const { snapshot } = feed
    const headers = new Headers({
      'Cache-Control': 'no-store, max-age=0',
      'Vary': 'Accept-Encoding',
    })
    if (snapshot.etag) headers.set('ETag', snapshot.etag)
    if (snapshot.publication_revision !== null) {
      headers.set('X-Gridex-Publication-Revision', String(snapshot.publication_revision))
    }
    if (snapshot.contract_version) {
      headers.set(GRIDEX_WEBSITE_API_VERSION_HEADER, snapshot.contract_version)
    }
    headers.set('X-Gridex-Data-Stale', snapshot.stale ? '1' : '0')
    headers.set('X-Gridex-Parser-Version', snapshot.parser_version)
    headers.set('X-Gridex-Schema-SHA256', snapshot.schema_sha256)
    headers.set('X-Request-ID', requestId)

    if (etagMatches(request, snapshot.etag)) {
      return new NextResponse(null, { status: 304, headers })
    }

    return NextResponse.json(
      buildPublicContractsPayload({ feed, requestId, correlationId }),
      { headers },
    )
  } catch (error) {
    const mapped = publicError(error)
    const reference = supportReference(error)
    console.error('[website public-contracts] OPS request failed', {
      code: isOpsError(error) ? error.code : null,
      status: isOpsError(error) ? error.status : null,
      upstream_request_id: isOpsError(error) ? error.requestId : null,
      upstream_correlation_id: isOpsError(error) ? error.correlationId : null,
      reference,
      request_id: requestId,
      correlation_id: correlationId,
    })
    return NextResponse.json(
      { error: { code: mapped.code, state: mapped.state, message: mapped.message, reference } },
      { status: mapped.status },
    )
  }
}
