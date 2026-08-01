import type { WebsitePublicContractFeed } from '@/lib/website/publicContractFeed'
import { toBrowserPublicContract } from '@/lib/website/publicDtos'

function publicIssueCode(code: string): string {
  if (code === 'openapi_additionalProperties') return 'upstream_contract_extended'
  if (code.startsWith('openapi_') || code === 'public_contract_normalization_failed') {
    return 'contract_temporarily_unavailable'
  }
  return code
}

function browserBlockedContracts(feed: WebsitePublicContractFeed) {
  return feed.blockedContracts.map((item) => ({
    offer_reference: item.offer_reference,
    source: item.source,
    reasons: [...new Set(item.reasons.map(publicIssueCode))],
  }))
}

function browserIssues(issues: WebsitePublicContractFeed['snapshot']['warnings']) {
  return issues.map((issue) => ({
    offer_reference: issue.offer_reference,
    code: publicIssueCode(issue.code),
    severity: issue.severity,
  }))
}

export function buildPublicContractsPayload(input: {
  feed: WebsitePublicContractFeed
  requestId: string
  correlationId: string
}) {
  const { feed } = input
  const { snapshot } = feed
  return {
    data: feed.contracts.map(toBrowserPublicContract),
    blocked_contracts: browserBlockedContracts(feed),
    warnings: browserIssues(snapshot.warnings),
    compatibility_issues: browserIssues(snapshot.compatibility_issues),
    meta: {
      channel: 'website' as const,
      state: feed.state,
      contract_version: snapshot.contract_version,
      publication_revision: snapshot.publication_revision,
      fetched_at: snapshot.fetched_at,
      source: snapshot.source,
      stale: snapshot.stale,
      upstream_status: snapshot.upstream_status,
      upstream_etag: snapshot.etag,
      parser_version: snapshot.parser_version,
      schema_sha256: snapshot.schema_sha256,
      request_id: input.requestId,
      correlation_id: input.correlationId,
      upstream_count: snapshot.contracts.length + snapshot.blocked_contracts.length,
      visible_count: feed.contracts.length,
      blocked_count: feed.blockedContracts.length,
      warning_count: snapshot.warnings.length,
      compatibility_issue_count: snapshot.compatibility_issues.length,
    },
  }
}
