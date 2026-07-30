import { NextResponse } from 'next/server'
import { getAdminContext } from '@/lib/admin/getAdminContext'
import {
  fetchOpsPublicContractDiagnostics,
  getVerifiedOpsIntegrationContext,
  isOpsError,
} from '@/lib/ops/client'
import { GRIDEX_WEBSITE_API_CONTRACT_VERSION } from '@/lib/ops/contract'
import {
  getGridexConfigurationStatus,
  getGridexDeploymentMetadata,
} from '@/lib/ops/config'
import { loadWebsitePublicContractFeed } from '@/lib/website/publicContractFeed'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type LastHealthState = {
  successAt: string | null
  errorAt: string | null
  error: {
    code: string | null
    status: number | null
    requestId: string | null
    correlationId: string | null
  } | null
}

let lastHealthState: LastHealthState = {
  successAt: null,
  errorAt: null,
  error: null,
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function tenantStatus(raw: Record<string, unknown>): string {
  const data = record(raw.data)
  const context = record(raw.context) ?? record(data?.context) ?? data ?? raw
  const value = context.tenant_status ?? context.tenantStatus ?? context.status
  return typeof value === 'string' && value.trim() ? value.trim() : 'unknown'
}

function safeOpsError(error: unknown) {
  return {
    code: isOpsError(error) ? error.code : 'unknown_upstream_error',
    status: isOpsError(error) ? error.status : null,
    requestId: isOpsError(error) ? error.requestId : null,
    correlationId: isOpsError(error) ? error.correlationId : null,
    retryable: isOpsError(error) ? error.retryable : false,
  }
}

export async function GET(request: Request) {
  const ctx = await getAdminContext()
  const authorized = ctx.isAdmin || ctx.permissions.includes('integrations.read') || ctx.permissions.includes('admin.access')
  if (!ctx.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const forceFresh = new URL(request.url).searchParams.get('force_refresh') === 'true'
  const configuration = getGridexConfigurationStatus()
  const deployment = getGridexDeploymentMetadata()
  const checkedAt = new Date().toISOString()

  try {
    const [context, feed, diagnosticsResult] = await Promise.all([
      getVerifiedOpsIntegrationContext(forceFresh),
      loadWebsitePublicContractFeed({
        context: 'gridex integration health',
        customerType: 'private',
        forceFresh,
      }),
      fetchOpsPublicContractDiagnostics('private')
        .then((value) => ({ ok: true as const, value }))
        .catch((error) => ({ ok: false as const, error: safeOpsError(error) })),
    ])

    const priceOptionCount = feed.contracts.reduce(
      (sum, contract) => sum + (contract.price_options?.length ?? 0),
      0,
    )
    const legalRequirementCount = feed.contracts.reduce(
      (sum, contract) => sum + (contract.legal_requirements?.length ?? 0),
      0,
    )
    const diagnostics = diagnosticsResult.ok
      ? diagnosticsResult.value.items.map((item) => ({
          offer_reference: item.offer_reference,
          visible: item.visible,
          blockers: item.blockers,
        }))
      : null

    lastHealthState = {
      successAt: checkedAt,
      errorAt: lastHealthState.errorAt,
      error: lastHealthState.error,
    }

    return NextResponse.json({
      ok: feed.contracts.length > 0 && context.capabilities.website_checkout_ready,
      checked_at: checkedAt,
      force_refresh: forceFresh,
      configuration,
      deployment: {
        commit_sha: deployment.commitSha,
        deployment_id: deployment.deploymentId,
        build_timestamp: deployment.buildTimestamp,
        local_api_contract_version: GRIDEX_WEBSITE_API_CONTRACT_VERSION,
      },
      integration: {
        tenant_verified: Boolean(context.tenant_reference),
        tenant_status: tenantStatus(context.raw),
        api_client_verified: Boolean(context.api_client_reference),
        contract_version: context.contract_version || null,
        active_scopes: context.active_scopes,
        website_checkout_ready: context.capabilities.website_checkout_ready,
        missing_scopes: context.capabilities.missing_website_checkout_scopes,
      },
      contracts: {
        state: feed.state,
        upstream_count: feed.snapshot.contracts.length + feed.snapshot.blocked_contracts.length,
        parsed_count: feed.snapshot.contracts.length,
        browser_ready_count: feed.contracts.length,
        blocked_count: feed.blockedContracts.length,
        blocked_contracts: feed.blockedContracts,
        price_option_count: priceOptionCount,
        legal_requirement_count: legalRequirementCount,
        etag_present: Boolean(feed.snapshot.etag),
        publication_revision: feed.snapshot.publication_revision,
        contract_version: feed.snapshot.contract_version,
        source: feed.snapshot.source,
        stale: feed.snapshot.stale,
        fetched_at: feed.snapshot.fetched_at,
      },
      diagnostics: diagnosticsResult.ok
        ? { available: true, items: diagnostics }
        : { available: false, error: diagnosticsResult.error },
      last: {
        successful_call_at: lastHealthState.successAt,
        failed_call_at: lastHealthState.errorAt,
        error: lastHealthState.error,
      },
    })
  } catch (error) {
    const safe = safeOpsError(error)
    lastHealthState = {
      successAt: lastHealthState.successAt,
      errorAt: checkedAt,
      error: {
        code: safe.code,
        status: safe.status,
        requestId: safe.requestId,
        correlationId: safe.correlationId,
      },
    }
    console.error('[gridex integration health] failed', safe)
    return NextResponse.json(
      {
        ok: false,
        checked_at: checkedAt,
        force_refresh: forceFresh,
        configuration,
        deployment: {
          commit_sha: deployment.commitSha,
          deployment_id: deployment.deploymentId,
          build_timestamp: deployment.buildTimestamp,
          local_api_contract_version: GRIDEX_WEBSITE_API_CONTRACT_VERSION,
        },
        error: safe,
        last: {
          successful_call_at: lastHealthState.successAt,
          failed_call_at: lastHealthState.errorAt,
        },
      },
      { status: safe.status && safe.status >= 400 && safe.status < 600 ? safe.status : 502 },
    )
  }
}
