export type AccountWriteKind='phone'|'notification';
type Input={phone:string}|{reference:string};
type Dependencies={enabled:()=>boolean;authenticate:(token:string)=>Promise<string|null>;submit:(subject:string,token:string,input:Input,key:string)=>Promise<Record<string,unknown>>};
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const reply=(status:number,error:string)=>Response.json({error},{status,headers});
export function accountWriteHandler(deps:Dependencies,kind:AccountWriteKind){
 return async(request:Request)=>{
  if(!deps.enabled())return reply(404,'Mobilanslutningen är inte aktiverad.');
  if(request.method!=='POST'||new URL(request.url).search)return reply(400,'Ogiltig begäran.');
  const token=/^Bearer ([A-Za-z0-9._~-]{16,8192})$/.exec(request.headers.get('authorization')??'')?.[1];if(!token)return reply(401,'Logga in igen.');
  const key=request.headers.get('idempotency-key')??'';if(!/^[A-Za-z0-9._:+~-]{8,120}$/.test(key))return reply(400,'Giltig försöksreferens krävs.');
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return reply(415,'JSON krävs.');
  try{
   const subject=await deps.authenticate(token);if(!subject)return reply(401,'Logga in igen.');
   const reader=request.body?.getReader();const chunks:Uint8Array[]=[];let size=0;
   if(reader)try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return reply(413,'Begäran är för stor.');}chunks.push(value);}}finally{reader.releaseLock();}
   const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
   let input:Input;
   try{
    const body=JSON.parse(new TextDecoder().decode(bytes));const field=kind==='phone'?'phone':'reference';
    if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).length!==1||typeof body[field]!=='string')throw Error('Invalid fields');
    const value=body[field].trim();
    if(kind==='phone'&&(!/^[+0-9() -]{7,40}$/.test(value)||value.replace(/\D/g,'').length<7||value.replace(/\D/g,'').length>15)||kind==='notification'&&!/^notification_[A-Za-z0-9_-]{20,64}$/.test(value))throw Error('Invalid value');
    input=kind==='phone'?{phone:value}:{reference:value};
   }catch{return reply(400,'Kontrollera uppgifterna.');}
   const data=await deps.submit(subject,token,input,key);if(data.accepted!==true)throw Error('Unconfirmed write');
   return Response.json({data},{headers});
  }catch(error){const status=error&&typeof error==='object'&&'status'in error?Number(error.status):503;return reply([403,404,409,429].includes(status)?status:503,'Ändringen kunde inte bekräftas. Försök igen med samma uppgifter.');}
 };
}
