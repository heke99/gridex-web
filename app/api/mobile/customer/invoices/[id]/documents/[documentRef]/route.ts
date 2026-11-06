import { customerDetailRoute } from '@/lib/mobile/customerRuntime';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string; documentRef: string }> }) {
  const { id, documentRef } = await context.params;
  if ([id, documentRef].some(ref => !/^[A-Za-z0-9_-]{1,240}$/.test(ref))) return Response.json({ error: 'Ogiltig referens.' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } });
  return customerDetailRoute('invoiceDocument', id, documentRef)(request);
}
