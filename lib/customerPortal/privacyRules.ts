export type PrivacyRequestKind = 'access' | 'erasure'
export type PrivacyRequestStatus = 'queued' | 'submitted' | 'needs_attention'

export const PRIVACY_REQUEST_LABELS: Record<PrivacyRequestKind, string> = {
  access: 'Registerutdrag',
  erasure: 'Radering av personuppgifter',
}

export const PRIVACY_HANDLING_LABELS: Record<string, string> = {
  open: 'Nytt ärende hos kundservice',
  waiting_on_customer: 'Kundservice inväntar ditt svar',
  waiting_on_internal: 'Under handläggning',
  resolved: 'Ärendet har hanterats',
  closed: 'Ärendet har avslutats',
}

export function parsePrivacyIntent(value: unknown): { kind: PrivacyRequestKind; operationId: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (Object.keys(row).some(key => !['kind', 'client_operation_id'].includes(key))) return null
  if (row.kind !== 'access' && row.kind !== 'erasure') return null
  if (typeof row.client_operation_id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.client_operation_id)) return null
  return { kind: row.kind, operationId: row.client_operation_id.toLowerCase() }
}

export function privacyRequestStatus(caseReference: string | null, queueStatus: string): PrivacyRequestStatus {
  if (caseReference && queueStatus === 'completed') return 'submitted'
  return queueStatus === 'dead_letter' || queueStatus === 'completed' ? 'needs_attention' : 'queued'
}

export function privacySupportInput(kind: PrivacyRequestKind, requestId: string) {
  return {
    title: kind === 'access' ? 'Begäran om registerutdrag' : 'Begäran om radering av personuppgifter',
    message: `${kind === 'access'
      ? 'Jag begär tillgång till mina personuppgifter och en kopia av dem.'
      : 'Jag begär att mina personuppgifter raderas där de inte behöver bevaras enligt lag eller för att fullgöra avtal.'}\nBegäran skickad från mitt inloggade konto. Referens: ${requestId}.`,
    category: 'data_protection',
  }
}
