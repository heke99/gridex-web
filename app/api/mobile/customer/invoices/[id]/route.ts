import { customerDetailRoute } from '@/lib/mobile/customerRuntime';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,240}$/.test(id)) return Response.json({ error: 'Ogiltig fakturareferens.' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } });
  return customerDetailRoute('invoiceDetail', id)(request);
}
