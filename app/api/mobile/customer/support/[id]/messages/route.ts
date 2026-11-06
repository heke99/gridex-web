import { supportMutation } from '@/lib/mobile/supportWriteRuntime';
export const runtime = 'nodejs';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
 const { id } = await context.params;
 if (!/^[A-Za-z0-9_-]{1,240}$/.test(id)) return Response.json({ error: 'Ogiltig referens.' }, { status: 400 });
 return supportMutation(id)(request);
}
