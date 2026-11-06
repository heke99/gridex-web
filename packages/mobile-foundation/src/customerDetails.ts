export type InvoiceLine = { reference: string; description: string | null; quantity: number | null; unitPrice: number | null; amountExVat: number | null; vatAmount: number | null; amountIncVat: number | null };
export type InvoiceDocument = { reference: string; title: string | null; type: string | null; available: boolean };
export type InvoiceDetail = {
  reference: string; number: string | null; status: string | null; currency: string | null;
  amount: number | null; dueDate: string | null; issuedAt: string | null; periodStart: string | null; periodEnd: string | null;
  lines: InvoiceLine[]; documents: InvoiceDocument[];
};
export type SupportCase = { reference: string; title: string; description: string | null; status: string; createdAt: string | null; updatedAt: string | null };
export type SupportMessage = { reference: string; author: 'customer' | 'staff'; kind: 'message' | 'phone_summary'; body: string; createdAt: string | null };
export type SupportDetail = SupportCase & { messages: SupportMessage[]; moreMessages: boolean | null };
