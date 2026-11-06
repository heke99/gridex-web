import type { InvoiceDetail, SupportDetail } from '../../../packages/mobile-foundation/src/customerDetails';
type Row = Record<string, unknown>;
const object = (v: unknown): Row => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid detail'); return v as Row; };
const string = (r: Row, k: string): string => { if (typeof r[k] !== 'string' || !r[k]) throw new Error('Invalid string'); return r[k] as string; };
const text = (r: Row, k: string): string | null => { if (r[k] !== null && typeof r[k] !== 'string') throw new Error('Invalid text'); return r[k] as string | null; };
const number = (r: Row, k: string): number | null => { if (r[k] !== null && (typeof r[k] !== 'number' || !Number.isFinite(r[k]))) throw new Error('Invalid number'); return r[k] as number | null; };
const array = (r: Row, k: string): unknown[] => { if (!Array.isArray(r[k])) throw new Error('Invalid rows'); return r[k] as unknown[]; };
const item = (body: unknown, key: string): Row => { const rows = array(object(object(body).data), key); if (rows.length !== 1) throw new Error('Invalid detail envelope'); return object(rows[0]); };

export function parseInvoiceDetail(body: unknown, expected: string): InvoiceDetail {
  const r = item(body, 'invoiceDetail'); if (string(r, 'reference') !== expected) throw new Error('Wrong invoice');
  return { reference: expected, number: text(r, 'number'), status: text(r, 'status'), currency: text(r, 'currency'), amount: number(r, 'amount'), dueDate: text(r, 'dueDate'), issuedAt: text(r, 'issuedAt'), periodStart: text(r, 'periodStart'), periodEnd: text(r, 'periodEnd'),
    lines: array(r, 'lines').map(value => { const line = object(value); return { reference: string(line, 'reference'), description: text(line, 'description'), quantity: number(line, 'quantity'), unitPrice: number(line, 'unitPrice'), amountExVat: number(line, 'amountExVat'), vatAmount: number(line, 'vatAmount'), amountIncVat: number(line, 'amountIncVat') }; }),
    documents: array(r, 'documents').map(value => { const doc = object(value); if (typeof doc.available !== 'boolean') throw new Error('Invalid document'); return { reference: string(doc, 'reference'), title: text(doc, 'title'), type: text(doc, 'type'), available: doc.available }; }),
  };
}
export function parseSupportDetail(body: unknown, expected: string): SupportDetail {
  const r = item(body, 'supportDetail'); if (string(r, 'reference') !== expected) throw new Error('Wrong case');
  const status = string(r, 'status'); if (!['received', 'in_progress', 'resolved', 'closed'].includes(status)) throw new Error('Invalid case status');
  if (typeof r.moreMessages !== 'boolean' && r.moreMessages !== null) throw new Error('Invalid pagination');
  return { reference: expected, title: string(r, 'title'), description: text(r, 'description'), status, createdAt: text(r, 'createdAt'), updatedAt: text(r, 'updatedAt'), moreMessages: r.moreMessages,
    messages: array(r, 'messages').map(value => {
      const m = object(value); const author = string(m, 'author'); const kind = string(m, 'kind'); const content = text(m, 'body');
      if ((author !== 'staff' && author !== 'customer') || (kind !== 'message' && kind !== 'phone_summary') || content === null || content.length > 8000) throw new Error('Invalid public message');
      return { reference: string(m, 'reference'), author, kind, body: content, createdAt: text(m, 'createdAt') };
    }),
  };
}
export function parseDocumentLink(body: unknown, expected: string, key: 'invoiceDocument' | 'customerDocument' = 'invoiceDocument'): string {
  const r = item(body, key); if (string(r, 'reference') !== expected) throw new Error('Wrong document');
  const url = new URL(string(r, 'url')); if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('Unsafe document link');
  return url.href;
}
export type CustomerView = 'contracts' | 'sites' | 'invoices' | 'support' | 'invoiceDetail' | 'supportDetail' | 'profile' | 'notifications' | 'documents' | 'powers' | 'acceptances';
/** References are opaque; they cannot introduce a path segment, query or origin. */
export function customerViewPath(view: CustomerView, reference?: string) {
  if (view !== 'invoiceDetail' && view !== 'supportDetail') return view;
  if (!reference || !/^[A-Za-z0-9_-]{1,240}$/.test(reference)) throw new Error('Invalid reference');
  return `${view === 'invoiceDetail' ? 'invoices' : 'support'}/${encodeURIComponent(reference)}`;
}
