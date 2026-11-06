export type Resource = 'contracts' | 'sites' | 'invoices' | 'support';
export type CustomerRow = { reference: string; [key: string]: string | number | null };
const fields: Record<Resource, string[]> = {
  contracts: ['name', 'status', 'startDate'],
  sites: ['address', 'postalCode', 'city', 'facilityId', 'priceArea', 'status'],
  invoices: ['number', 'status', 'currency', 'dueDate', 'paidAt'],
  support: ['title', 'description', 'status', 'createdAt', 'updatedAt'],
};
export function parseCustomerRows(resource: Resource, body: unknown): CustomerRow[] {
  const rows = (body as { data?: Record<string, unknown> })?.data?.[resource];
  if (!Array.isArray(rows)) throw new Error('Invalid customer response');
  return rows.map(row => {
    if (!row || typeof row.reference !== 'string' || !row.reference
      || fields[resource].some(k => row[k] !== null && typeof row[k] !== 'string')
      || (resource === 'invoices' && row.amount !== null && (typeof row.amount !== 'number' || !Number.isFinite(row.amount)))) throw new Error('Invalid customer row');
    return Object.fromEntries(['reference', ...fields[resource], ...(resource === 'invoices' ? ['amount'] : [])].map(k => [k, row[k]])) as CustomerRow;
  });
}
/** Password reset stays in the existing verified web flow; never append tokens. */
export function recoveryUrl(api: string): string {
  const origin = new URL(api);
  if (origin.protocol !== 'https:' || origin.username || origin.password) throw new Error('Invalid recovery origin');
  return new URL('/login/forgot-password', origin.origin).href;
}
