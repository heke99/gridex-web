import type { InvoiceDetail, SupportCase, SupportDetail } from '../../packages/mobile-foundation/src/customerDetails';

export const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (row: Record<string, unknown>, key: string) => typeof row[key] === 'string' ? row[key] as string : null;
const reference = (row: Record<string, unknown>, key: string) => {
  const value = text(row, key); if (!value || !/^[A-Za-z0-9_-]{1,240}$/.test(value)) throw new Error('Invalid resource reference'); return value;
};
const amount = (row: Record<string, unknown>, key: string) => {
  const value = row[key]; if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Invalid monetary value'); return value;
};

/** Return only HTTPS links on explicitly configured provider origins; never proxy/fetch URLs. */
export function approvedDocumentUrl(value: unknown, origins: readonly string[]): string | null {
  if (typeof value !== 'string' || value.length > 16000) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) return null;
    const allowed = origins.some(origin => {
      try { const o = new URL(origin); return o.protocol === 'https:' && o.pathname === '/' && !o.search && !o.hash && !o.username && !o.password && o.origin === url.origin; }
      catch { return false; }
    });
    return allowed ? url.href : null;
  } catch { return null; }
}

function invoiceData(payload: unknown, expected: string) {
  const data = record(record(payload).data); const invoice = record(data.invoice);
  if (reference(invoice, 'invoice_reference') !== expected) throw new Error('Invoice identity mismatch');
  if (!Array.isArray(data.lines) || !Array.isArray(data.documents)) throw new Error('Invalid invoice detail envelope');
  return { data, invoice, lines: data.lines, documents: data.documents };
}

export function invoiceDetail(payload: unknown, expected: string, origins: readonly string[]): InvoiceDetail {
  const { invoice, lines, documents } = invoiceData(payload, expected);
  return {
    reference: expected, number: text(invoice, 'invoice_number'), status: text(invoice, 'status'), currency: text(invoice, 'currency'),
    amount: amount(invoice, 'amount_inc_vat'), dueDate: text(invoice, 'due_date'), issuedAt: text(invoice, 'issued_at'), periodStart: text(invoice, 'period_start'), periodEnd: text(invoice, 'period_end'),
    lines: lines.map(value => { const line = record(value); return { reference: reference(line, 'line_reference'), description: text(line, 'description'), quantity: amount(line, 'quantity'), unitPrice: amount(line, 'unit_price'), amountExVat: amount(line, 'amount_ex_vat'), vatAmount: amount(line, 'vat_amount'), amountIncVat: amount(line, 'amount_inc_vat') }; }),
    documents: documents.map(value => { const doc = record(value); return { reference: reference(doc, 'document_reference'), title: text(doc, 'title'), type: text(doc, 'document_type'), available: approvedDocumentUrl(doc.secure_url, origins) !== null }; }),
  };
}

/** Called after re-authentication and a fresh same-customer invoice read on every click. */
export function invoiceDocument(payload: unknown, expected: string, docRef: string, origins: readonly string[]) {
  const { documents } = invoiceData(payload, expected);
  const matches = documents.map(record).filter(doc => text(doc, 'document_reference') === docRef);
  if (matches.length !== 1) throw new Error('Document is not attached to this invoice');
  const url = approvedDocumentUrl(matches[0].secure_url, origins);
  if (!url) throw new Error('Document link unavailable');
  return { reference: docRef, url };
}

function supportCase(value: unknown): SupportCase {
  const row = record(value); const title = text(row, 'title'); const status = text(row, 'status');
  if (!title || !['received', 'in_progress', 'resolved', 'closed'].includes(status ?? '')) throw new Error('Invalid customer-visible case');
  return { reference: reference(row, 'case_reference'), title, description: text(row, 'description'), status: status!, createdAt: text(row, 'created_at'), updatedAt: text(row, 'updated_at') };
}
export function supportCases(payload: unknown): SupportCase[] {
  const data = record(payload).data; if (!Array.isArray(data)) throw new Error('Invalid support envelope');
  return data.map(supportCase);
}
export function supportDetail(detail: unknown, messages: unknown, expected: string): SupportDetail {
  const row = supportCase(record(detail).data);
  if (row.reference !== expected) throw new Error('Support identity mismatch');
  const data = record(messages).data; if (!Array.isArray(data)) throw new Error('Invalid messages envelope');
  const page = record(record(messages).page);
  return { ...row, moreMessages: typeof page.has_more === 'boolean' ? page.has_more : null,
    messages: data.map(value => {
      const message = record(value); const author = text(message, 'author_type'); const kind = text(message, 'kind'); const body = text(message, 'body');
      // Internal notes and staff identities never cross the mobile boundary.
      if ((author !== 'customer' && author !== 'staff') || (kind !== 'message' && kind !== 'phone_summary') || body === null) throw new Error('Invalid public message');
      return { reference: reference(message, 'message_reference'), author, kind, body, createdAt: text(message, 'created_at') };
    }),
  };
}
