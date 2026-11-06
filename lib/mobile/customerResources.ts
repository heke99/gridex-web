export type Resource = 'contracts' | 'sites' | 'invoices';
type Row = Record<string, unknown>;
const text = (r: Row, key: string) => typeof r[key] === 'string' ? r[key] as string : null;
const record = (v: unknown): Row => v && typeof v === 'object' && !Array.isArray(v) ? v as Row : {};

/** Whitelist customer-facing fields; never forward an unfiltered OPS payload. */
export function normalizeResource(resource: Resource, payload: unknown): Row[] {
  const data = record(payload).data;
  const rows = Array.isArray(data) ? data : record(data)[resource];
  if (!Array.isArray(rows)) throw new Error('Invalid resource envelope');
  return rows.map(value => {
    const row = record(value);
    const refKey = { contracts: 'contract_reference', sites: 'facility_reference', invoices: 'invoice_reference' }[resource];
    const reference = text(row, refKey);
    if (!reference) throw new Error('Missing resource reference');
    if (resource === 'contracts') return { reference, name: text(row, 'contract_name'), status: text(row, 'status'), startDate: text(row, 'start_date') };
    if (resource === 'sites') {
      const address = record(row.address);
      return { reference, address: text(address, 'street'), postalCode: text(address, 'postal_code'), city: text(address, 'city'),
        facilityId: text(row, 'facility_id'), priceArea: text(row, 'price_area'), status: text(row, 'status') };
    }
    return { reference, number: text(row, 'invoice_number'), status: text(row, 'status'),
      amount: typeof row.amount_inc_vat === 'number' && Number.isFinite(row.amount_inc_vat) ? row.amount_inc_vat : null,
      currency: text(row, 'currency'), dueDate: text(row, 'due_date'), paidAt: text(row, 'paid_at') };
  });
}
