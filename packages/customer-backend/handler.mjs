import {projectCustomerItems} from './projection.mjs';
export class CustomerBackendError extends Error {
 constructor(status){super('Provider operation rejected');if(![403,404,409,429].includes(status))throw new Error('Unsupported public status');this.status=status;}
}
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const reply=(status,body)=>Response.json(body,{status,headers});
const lists=new Set(['contracts','sites','invoices','support','profile','notifications','documents','powers','acceptances']);
const ref=/^[A-Za-z0-9_-]{1,240}$/;
/** Provider verifies identity and enforces tenant/customer scope on EVERY operation.
 * No OPS, database SDK or auth vendor dependency. Mount at a trusted fixed prefix. */
export function createCustomerBackend({authenticate,provider,prefix='/customer/v1',documentOrigins=[]}) {
 if(typeof authenticate!=='function'||typeof provider?.read!=='function')throw new Error('Backend adapters required');
 if(!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(prefix))throw new Error('Invalid prefix');
 return async request=>{
  const url=new URL(request.url);
  if(!url.pathname.startsWith(`${prefix}/`))return reply(404,{error:'Not found'});
  const parts=url.pathname.slice(prefix.length+1).split('/');
  const [resource,reference,third,fourth]=parts;
  let key;
  if(parts.length===1&&lists.has(resource))key=resource;
  else if(parts.length===2&&resource==='notifications'&&reference==='read')key='notificationRead';
  else if(parts.length===2&&ref.test(reference)&&['invoices','support'].includes(resource))key=resource==='invoices'?'invoiceDetail':'supportDetail';
  else if(parts.length===3&&resource==='documents'&&ref.test(reference)&&third==='open')key='customerDocument';
  else if(parts.length===4&&resource==='invoices'&&ref.test(reference)&&third==='documents'&&ref.test(fourth))key='invoiceDocument';
  else if(parts.length===3&&resource==='support'&&ref.test(reference)&&third==='messages')key='reply';
  else return reply(404,{error:'Not found'});
  const write=request.method==='POST'&&(key==='support'||key==='reply'||key==='profile'||key==='notificationRead');
  if(request.method!=='GET'&&!write||request.method==='GET'&&['reply','notificationRead'].includes(key))return reply(405,{error:'Method not allowed'});
  const query=url.searchParams;
  if([...query.keys()].some(k=>k!=='cursor'||key!=='support'||write)||query.getAll('cursor').length>1||(query.has('cursor')&&(!query.get('cursor')||query.get('cursor').length>2048)))return reply(400,{error:'Invalid query'});
  const token=/^Bearer ([A-Za-z0-9._~-]{16,8192})$/.exec(request.headers.get('authorization')??'')?.[1];
  if(!token)return reply(401,{error:'Authentication required'});
  try {
   const identity=await authenticate(token);
   if(!identity||typeof identity.subject!=='string'||!identity.subject||typeof identity.tenantId!=='string'||!identity.tenantId||typeof identity.customerReference!=='string'||!identity.customerReference)return reply(401,{error:'Authentication required'});
   // Pass only verified identity; raw headers/body identities never reach providers.
   const binding=Object.freeze({subject:identity.subject,tenantId:identity.tenantId,customerReference:identity.customerReference});
   if(write){
    if(typeof provider.write!=='function')return reply(405,{error:'Writes not supported'});
    const keyHeader=request.headers.get('idempotency-key');
    if(!/^[A-Za-z0-9_-]{8,160}$/.test(keyHeader??''))return reply(400,{error:'Idempotency key required'});
    if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return reply(415,{error:'JSON required'});
    const reader=request.body?.getReader();if(!reader)return reply(400,{error:'Body required'});
    let size=0;const chunks=[];try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>32768){await reader.cancel();return reply(413,{error:'Body too large'});}chunks.push(value);}}finally{reader.releaseLock();}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return reply(400,{error:'Invalid JSON'});}
    const allowed=key==='profile'?['phone']:key==='notificationRead'?['reference']:key==='reply'?['message']:['title','message'];
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k))||allowed.some(k=>typeof body[k]!=='string'||!body[k].trim()||body[k].length>(k==='title'?200:8000)))return reply(400,{error:'Invalid message'});
    if(key==='profile'&&(!/^[+0-9() -]{7,40}$/.test(body.phone)||body.phone.replace(/\D/g,'').length<7||body.phone.replace(/\D/g,'').length>15)||key==='notificationRead'&&!ref.test(body.reference))return reply(400,{error:'Invalid account change'});
    const input=Object.fromEntries(allowed.map(k=>[k,body[k]]));
    const result=await provider.write(binding,{kind:key==='profile'?'phone':key,reference:key==='notificationRead'?body.reference:reference,input,idempotencyKey:keyHeader});
    if(result?.accepted!==true)throw new Error('Unconfirmed write');
    if(key==='notificationRead'&&(typeof result.readAt!=='string'||!Number.isFinite(Date.parse(result.readAt))))throw new Error('Read time required');
    return reply(key==='profile'||key==='notificationRead'?200:201,{data:{accepted:true,...(key==='notificationRead'?{readAt:result.readAt}:{})}});
   }
   const result=await provider.read(binding,{kind:key,reference,documentReference:fourth,cursor:query.get('cursor')??undefined});
   if(!result||!Array.isArray(result.items))throw new Error('Invalid provider output');
   if(key==='invoiceDocument'||key==='customerDocument'){
    if(result.items.length!==1||result.items[0].reference!==(fourth??reference))throw new Error('Wrong document');
    const doc=new URL(result.items[0].url);if(doc.protocol!=='https:'||doc.username||doc.password||doc.hash||!documentOrigins.includes(doc.origin))throw new Error('Unapproved document');
    return reply(200,{data:{[key]:[{reference:result.items[0].reference,url:doc.href}]}});
   }
   if((key==='invoiceDetail'||key==='supportDetail')&&(result.items.length!==1||result.items[0].reference!==reference))throw new Error('Wrong detail');
   const items=projectCustomerItems(key,result.items);
   const page=result.page;
   if(key==='support'&&page&&(![true,false,null].includes(page.hasMore)||(page.nextCursor!==null&&(typeof page.nextCursor!=='string'||!page.nextCursor||page.nextCursor.length>2048))||(page.hasMore===true&&!page.nextCursor)))throw new Error('Invalid pagination');
   return reply(200,{data:{[key]:items},...(key==='support'&&result.page?{page:{hasMore:page.hasMore,nextCursor:page.hasMore===false?null:page.nextCursor}}:{})});
  }catch(error){return error instanceof CustomerBackendError?reply(error.status,{error:'Operation could not be completed'}):reply(503,{error:'Customer service unavailable'});}
 };
}
