import { customerDocumentRoute } from '@/lib/mobile/customerRuntime';
export const runtime='nodejs';
export async function GET(request:Request, context:{params:Promise<{id:string}>}) {
 const {id}=await context.params; if(!/^[A-Za-z0-9_-]{1,240}$/.test(id))return Response.json({error:'Ogiltig referens.'},{status:400});
 return customerDocumentRoute(id)(request);
}
