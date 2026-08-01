export type PublicContractMetricName =
  | 'gridex_web_contracts_upstream_count'
  | 'gridex_web_contracts_visible_count'
  | 'gridex_web_contracts_blocked_count'
  | 'gridex_web_contracts_schema_warning_count'
  | 'gridex_web_contracts_compatibility_issue_count'
  | 'gridex_web_contracts_feed_empty_count'

type MetricContext = {
  context: string
  upstreamCount: number
  visibleCount: number
  blockedCount: number
  warningCount: number
  compatibilityIssueCount: number
  feedEmpty: boolean
  contractVersion: string | null
  parserVersion: string
  publicationRevision: number | null
}

export function emitPublicContractMetrics(input: MetricContext): void {
  const metrics: Record<PublicContractMetricName, number> = {
    gridex_web_contracts_upstream_count: input.upstreamCount,
    gridex_web_contracts_visible_count: input.visibleCount,
    gridex_web_contracts_blocked_count: input.blockedCount,
    gridex_web_contracts_schema_warning_count: input.warningCount,
    gridex_web_contracts_compatibility_issue_count: input.compatibilityIssueCount,
    gridex_web_contracts_feed_empty_count: input.feedEmpty ? 1 : 0,
  }
  for (const [metric, value] of Object.entries(metrics)) {
    console.info('[gridex-metric]', {
      metric,
      value,
      context: input.context,
      contract_version: input.contractVersion,
      parser_version: input.parserVersion,
      publication_revision: input.publicationRevision,
    })
  }
}
