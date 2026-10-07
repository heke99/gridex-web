import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import ts from 'typescript'
import nodeCrypto, { webcrypto } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..');
function harness(file, boundaries = {}, globals = {}) {
  const states = [], refs = [], effects = []; let si = 0, ri = 0;
  const react = { useState(initial) { const i = si++; if (!(i in states)) states[i] = initial; return [states[i], value => states[i] = value]; }, useRef(initial) { const i = ri++; return refs[i] ??= {current: initial}; }, useEffect(fn) { effects.push(fn); }, useMemo(fn) { return fn(); } };
  const jsx = (type, props) => ({type, props});
  const mod = {exports:{}};
  const context = {module:mod,exports:mod.exports,require(name) { if(name==='react')return react; if(name==='react/jsx-runtime')return {jsx,jsxs:jsx}; if(name==='next/link')return {default:'a'}; if(name in boundaries)return boundaries[name]; throw Error('Unmocked boundary '+name); }, crypto:webcrypto,TextEncoder,window:{location:{search:'',origin:'https://example.invalid'}},console,...globals};
  const source = fs.readFileSync(root+'/'+file,'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,context,{filename:file});
  return {states,effects,render(props) {si=ri=0; return mod.exports.default(props);},exports:mod.exports};
}
function nodes(tree) { if(!tree||typeof tree!=='object')return []; return [tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)]; }
function text(tree) { if(typeof tree==='string')return tree; if(!tree||typeof tree!=='object')return ''; return [tree.props?.children].flat(Infinity).map(text).join(' '); }
const event = {preventDefault(){}};
import { test } from 'node:test'
const policy=harness('lib/auth/passwordPolicy.ts').exports;
const business=harness('lib/website/businessDate.ts').exports;
const display=harness('lib/customerPortal/display.ts',{'@/lib/website/businessDate':business}).exports;
const writes=harness('lib/customerPortal/writeResponse.ts').exports;
const memory=()=>{const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}};
const props={site:null,userId:'test-user',latestUnreadNotificationId:'test-notification'};
const portal=(response,storage=memory())=>harness('components/customer/CustomerPortalSelfService.tsx',{
 'next/navigation':{useRouter:()=>({refresh(){}})},'@/lib/website/businessDate':business,
 '@/lib/customerPortal/writeResponse':writes
},{sessionStorage:storage,fetch:async()=>response});
const ok=json=>({ok:true,json:async()=>json});
test('recovery hides only account existence, never delivery and rate-limit failures',async()=>{
 for(const error of [{status:500,code:'unexpected_failure',message:'Error sending recovery email to user'}, {status:429,code:'over_email_send_rate_limit',message:'Email rate limit exceeded for this user'},{status:404,code:'user_not_found',message:'User not found'}]){
 const h=harness('app/login/forgot-password/page.tsx',{'@/lib/supabase/client':{createSupabaseBrowserClient:()=>({auth:{resetPasswordForEmail:async()=>({error})}})}});
 h.render();h.states[0]='test@example.invalid';await nodes(h.render()).find(n=>n.type==='form').props.onSubmit(event);
 assert.equal(h.states[1],error.code==='user_not_found');if(error.code!=='user_not_found')assert.ok(h.states[2]);
 }
});
test('support rejects excess input before RPC and preserves the complete allowed message',async()=>{
 let calls=0;
 const h=harness('app/api/support/public/route.ts',{'next/server':{NextResponse:{json:(body,o)=>({body,status:o?.status??200})}},'next/headers':{headers:async()=>new Headers()},'@/lib/supabase/service':{supabaseService:{rpc:async(_,args)=>{calls++;assert.equal(args.p_message.length,4000);return {data:'ticket',error:null}}}},'@/lib/security/rateLimit':{clientIpFromHeaders:()=>null,checkRateLimit:async()=>({allowed:true})},'@/lib/ops/client':{hashIp:()=>null},'node:crypto':nodeCrypto},{Headers});
 const payload={client_operation_id:webcrypto.randomUUID(),name:'Test',email:'test@example.invalid',subject:'Test',message:'A'.repeat(4001)};
 assert.equal((await h.exports.POST({json:async()=>payload})).status,400);assert.equal(calls,0);
 payload.message='A'.repeat(4000);assert.equal((await h.exports.POST({json:async()=>payload})).status,200);assert.equal(calls,1);
});
test('support retries across remount with same ID and retains it for malformed success',async()=>{
 const storage=memory(),requests=[],payload={name:'Test',email:'test@example.invalid',subject:'Test',message:'Test'};
 for(let mount=0;mount<2;mount++){
 const h=harness('app/(public)/kundservice/KundserviceClient.tsx',{}, {sessionStorage:storage,FormData:class{get(k){return payload[k]}},fetch:async(_,r)=>{requests.push(JSON.parse(r.body));return ok({})}});
 await nodes(h.render({faqItems:[]})).find(n=>n.type==='form').props.onSubmit({...event,currentTarget:{reset(){throw Error('Must not reset')}}});
 assert.equal(h.states[0],'error');
 }
 assert.equal(requests[0].client_operation_id,requests[1].client_operation_id);assert.equal(storage.map.size,1);
});
test('invalid write responses keep retry identity and show error',async()=>{
 for(const response of [{ok:true,json:async()=>{throw SyntaxError()}},ok({}),ok({data:{status:'accepted'}})]){
 const storage=memory(),h=portal(response,storage);
 await nodes(h.render(props)).find(n=>n.type==='button'&&text(n).includes('Uppdatera Mina sidor')).props.onClick();
 assert.equal(h.states[1].kind,'error');assert.equal(storage.map.size,1);
 }
});
test('pending and rejected writes are never completed',async()=>{
 const pending=await writes.readCustomerWriteResponse(ok({data:{ok:false,status:'pending_review'},queued:false}));assert.equal(writes.pendingCustomerWrite(pending),true);
 await assert.rejects(writes.readCustomerWriteResponse(ok({data:{ok:false,status:'rejected'}})));
 assert.equal(writes.pendingCustomerWrite(await writes.readCustomerWriteResponse(ok({data:{ok:true,status:'accepted'}}))),false);
});
test('successful notification read removes unread banner',async()=>{
 const h=portal(ok({ok:true,queued:false}));await nodes(h.render(props)).find(n=>n.type==='button'&&text(n).includes('Markera som läst')).props.onClick();
 assert.equal(h.states[4].kind,'success');assert.equal(text(h.render(props)).includes('Senaste meddelandet är oläst.'),false);
});
test('recovery state expires on signout',async()=>{
 let callback;
 const h=harness('app/login/reset-password/page.tsx',{'next/navigation':{useRouter:()=>({})},'@/lib/auth/passwordPolicy':policy,'@/lib/supabase/client':{createSupabaseBrowserClient:()=>({auth:{getSession:async()=>({data:{session:{user:{}}},error:null}),onAuthStateChange:fn=>{callback=fn;return {data:{subscription:{unsubscribe(){}}}}}}})}});
 h.render();h.effects[0]();await Promise.resolve();assert.equal(h.states[0],'ready');callback('SIGNED_OUT',null);assert.equal(h.states[0],'expired');
});
test('profile password preserves input exactly',async()=>{
 let password;
 const h=harness('app/dashboard/profile/actions.ts',{'next/cache':{revalidatePath(){}},'next/navigation':{redirect:path=>{throw Error('REDIRECT '+path)}},'@/lib/supabase/server':{createSupabaseServerActionClient:async()=>({auth:{updateUser:async payload=>{password=payload.password;return {error:null}}}})},'@/lib/ops/client':{},'@/lib/customerPortal/service':{},'@/lib/supabase/service':{},'@/lib/auth/passwordPolicy':policy});
 await assert.rejects(h.exports.updateCustomerPasswordAction({get:()=> ' Abcdef12! '}),/REDIRECT/);assert.equal(password,' Abcdef12! ');
});
test('invoice detail preserves opaque references containing percent signs',async()=>{
 let forwarded;
 const h=harness('app/api/web/customer/invoices/[id]/route.ts',{'@/lib/api/webBoundary':{webErrorResponse:()=>({status:400})},'@/lib/customerPortal/resourceRoute':{customerResourceResponse:async(_,id)=>{forwarded=id;return {status:200}}}});
 for(const id of ['invoice%2Fpart','invoice%reference']){await h.exports.GET({}, {params:Promise.resolve({id})});assert.equal(forwarded,id)}
});
test('dates use Swedish time, preserve calendar days and tolerate malformed dates and currencies',()=>{
 assert.equal(display.formatCustomerDate('2026-10-07T22:30:00Z'),'2026-10-08');
 assert.equal(display.formatCustomerDate('2026-01-07T23:30:00Z'),'2026-01-08');
 assert.equal(display.formatCustomerDate('2026-10-07'),'2026-10-07');
 for(const invalid of ['invalid-date','2026-02-30',null])assert.equal(display.formatCustomerDate(invalid),'—');
 assert.ok(display.formatCustomerCurrency(123.45,'invalid').includes('valuta saknas'));
});
test('beacon rejection uses fetch fallback without interrupting click',()=>{
 let fallback=0,callback=0;
 const h=harness('components/customer/EventLink.tsx',{}, {navigator:{sendBeacon:()=>false},Blob,fetch:async()=>{fallback++}});
 h.render({eventType:'customer.opened_document',children:'Test',onClick:()=>callback++}).props.onClick({});assert.equal(fallback,1);assert.equal(callback,1);
});
test('dashboard repair retains intent and does not reset while pending',async()=>{
 let resets=0;const ids=[];
 const h=harness('app/dashboard/error.tsx',{'@/lib/customerPortal/writeResponse':writes},{fetch:async(_,r)=>{ids.push(JSON.parse(r.body).client_operation_id);return ok({data:{ok:false,status:'pending_review'}})}});
 for(let i=0;i<2;i++)await nodes(h.render({reset:()=>resets++})).find(n=>n.type==='button').props.onClick();
 assert.equal(h.states[0],'pending');assert.equal(resets,0);assert.equal(ids[0],ids[1]);
});
