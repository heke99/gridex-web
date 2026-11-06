export const invoiceId = `invoice_${'a'.repeat(24)}`;
export const documentId = `document_${'b'.repeat(24)}`;
export const caseId = `support_case_${'c'.repeat(24)}`;
export function invoicePayload(reference = invoiceId) {
  return { data: {
    invoice: { invoice_reference: reference, invoice_number: '10001', status: 'issued', currency: 'SEK', amount_inc_vat: 125, due_date: '2026-12-01', issued_at: '2026-11-01', period_start: '2026-10-01', period_end: '2026-10-31', internal_customer_id: 'must-not-leak' },
    lines: [{ line_reference: `invoice_line_${'d'.repeat(24)}`, description: 'Elförbrukning', quantity: 100, unit_price: 1, amount_ex_vat: 100, vat_amount: 25, amount_inc_vat: 125, metadata: { internal: 'must-not-leak' } }],
    documents: [{ document_reference: documentId, title: 'Faktura', document_type: 'invoice_pdf', secure_url: 'https://files.example.test/invoice.pdf?signature=test-only', internal_path: 'must-not-leak' }],
  } };
}
export function supportPayload(reference = caseId) {
  return { data: { case_reference: reference, title: 'Fråga om min faktura', description: 'Kan ni förklara beloppet?', status: 'in_progress', created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-02T10:00:00Z', internal_note: 'must-not-leak' } };
}
export function messagesPayload() {
  return { data: [{ message_reference: `support_message_${'e'.repeat(24)}`, author_type: 'staff', kind: 'message', body: 'Här är förklaringen.', created_at: '2026-11-02T10:00:00Z', employee_id: 'must-not-leak' }], page: { has_more: false } };
}
