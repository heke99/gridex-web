import { approvedDocumentUrl, record } from './customerDetails';
export type Extra = 'profile' | 'notifications' | 'documents' | 'powers' | 'acceptances';
export const extraResources = { profile: 'me', notifications: 'notifications', documents: 'documents', powers: 'powers-of-attorney', acceptances: 'legal-acceptances' } as const;
const references: Record<Extra, string> = { profile: 'customer_reference', notifications: 'notification_reference', documents: 'document_reference', powers: 'power_of_attorney_reference', acceptances: 'acceptance_reference' };
const fields: Record<Extra, Record<string, string>> = {
  profile: { name: 'display_name', email: 'email', phone: 'phone', customerNumber: 'customer_number', customerType: 'customer_type', status: 'status' },
  notifications: { title: 'title', message: 'message', severity: 'severity', status: 'status', readAt: 'read_at', createdAt: 'created_at' },
  documents: { title: 'title', type: 'document_type', version: 'version', status: 'status', createdAt: 'created_at' },
  powers: { scope: 'scope', status: 'status', acceptedAt: 'accepted_at', validFrom: 'valid_from', validTo: 'valid_to' },
  acceptances: { type: 'acceptance_type', documentCode: 'document_code', version: 'document_version', acceptedAt: 'accepted_at', source: 'source' },
};
export function extraRows(kind: Extra, payload: unknown, origins: readonly string[] = []) {
  const data = record(payload).data;
  const nested = { notifications: 'notifications', documents: 'documents', powers: 'powers_of_attorney', acceptances: 'legal_acceptances' };
  const rows = kind === 'profile' ? [data] : Array.isArray(data) ? data : record(data)[nested[kind]];
  if (!Array.isArray(rows)) throw new Error('Invalid customer resource envelope');
  return rows.map(value => {
    const row = record(value), reference = row[references[kind]];
    if (typeof reference !== 'string' || !reference) throw new Error('Missing canonical reference');
    const output: Record<string, string | null> = { reference };
    for (const [target, source] of Object.entries(fields[kind])) output[target] = typeof row[source] === 'string' ? row[source] as string : null;
    if (kind === 'powers' && Array.isArray(row.scope) && row.scope.every(v => typeof v === 'string')) output.scope = row.scope.join(', ');
    if (kind === 'documents') output.availability = approvedDocumentUrl(row.secure_url, origins) ? 'available' : 'unavailable';
    return output;
  });
}
export function customerDocumentLink(payload: unknown, reference: string, origins: readonly string[]) {
  const data = record(payload).data, rows = Array.isArray(data) ? data : record(data).documents;
  if (!Array.isArray(rows)) throw new Error('Invalid documents');
  const matched = rows.map(record).filter(row => row.document_reference === reference);
  if (matched.length !== 1) throw new Error('Document not owned or ambiguous');
  const url = approvedDocumentUrl(matched[0].secure_url, origins); if (!url) throw new Error('Document unavailable');
  return { reference, url };
}
