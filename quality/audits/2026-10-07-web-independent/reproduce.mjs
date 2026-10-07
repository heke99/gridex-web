import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import ts from 'typescript'
import nodeCrypto, { webcrypto } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../../..');
const results = [];
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
(async()=>{
 for(const error of [{status:500,code:'unexpected_failure',message:'Error sending recovery email to user'},{status:429,code:'over_email_send_rate_limit',message:'Email rate limit exceeded for this user'}]) {
  const h = harness('app/login/forgot-password/page.tsx',{'@/lib/supabase/client':{createSupabaseBrowserClient:()=>({auth:{resetPasswordForEmail:async()=>({error})}})}});
  h.render();h.states[0]='test@example.invalid';const tree=h.render();await nodes(tree).find(n=>n.type==='form').props.onSubmit(event);
  assert.equal(h.states[1],true);assert.equal(h.states[2],null);
  results.push({finding:'W01',input:error,status:'reproduced',observed:'sent=true, error=null despite provider error'});
 }
 let captured;
 const route = harness('app/api/support/public/route.ts',{'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status??200})}},'next/headers':{headers:async()=>new Headers()},'@/lib/supabase/service':{supabaseService:{rpc:async(_,args)=>{captured=args;return {data:'synthetic-ticket',error:null}}}},'@/lib/security/rateLimit':{clientIpFromHeaders:()=>null,checkRateLimit:async()=>({allowed:true})},'@/lib/ops/client':{hashIp:()=>null},'node:crypto':nodeCrypto},{Headers});
 const response=await route.exports.POST({json:async()=>({client_operation_id:webcrypto.randomUUID(),name:'Test',email:'test@example.invalid',subject:'Test',message:'A'.repeat(4000)+'VIKTIG KOMPLETTERING'})});
 assert.equal(response.status,200);assert.equal(captured.p_message.length,4000);assert.equal(captured.p_message.includes('VIKTIG'),false);
 results.push({finding:'W02',status:'reproduced',observed:'HTTP 200, last 19 characters discarded before RPC'});
 const requests=[]; const payload={name:'Test',email:'test@example.invalid',subject:'Test',message:'Test'};
 for(let mount=0;mount<2;mount++) {
  const h=harness('app/(public)/kundservice/KundserviceClient.tsx',{}, {FormData:class{get(k){return payload[k]}},fetch:async(_,request)=>{requests.push(JSON.parse(request.body));throw Error('Response lost after simulated commit');}});
  await nodes(h.render({faqItems:[]})).find(n=>n.type==='form').props.onSubmit({...event,currentTarget:{reset(){}}});
 }
 assert.notEqual(requests[0].client_operation_id,requests[1].client_operation_id);
 results.push({finding:'W03',status:'reproduced',observed:'Identical support inquiry receives different operation IDs after remount following unknown outcome'});
 const storage=new Map();
 const portal=harness('components/customer/CustomerPortalSelfService.tsx',{'@/lib/website/businessDate':{stockholmCalendarDate:()=> '2026-10-07'}},{sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fetch:async()=>({ok:true,json:async()=>{throw SyntaxError('HTML response')}})});
 const props={site:null,userId:'synthetic-user',latestUnreadNotificationId:'synthetic-notification'};
 await nodes(portal.render(props)).find(n=>n.type==='button' && text(n).includes('Uppdatera Mina sidor')).props.onClick();
 assert.equal(portal.states[0].kind,'success');assert.equal(storage.size,0);
 results.push({finding:'W04',status:'reproduced',observed:'Invalid JSON response produces success and deletes persistent operation ID'});
 let callback;
 const reset=harness('app/login/reset-password/page.tsx',{'next/navigation':{useRouter:()=>({})},'@/lib/auth/passwordPolicy':{passwordStrength:()=>0,passwordMeetsPolicy:()=>true},'@/lib/supabase/client':{createSupabaseBrowserClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'synthetic'}}},error:null}),onAuthStateChange:fn=>{callback=fn;return {data:{subscription:{unsubscribe(){}}}}}}})}});
 reset.render();reset.effects[0]();await Promise.resolve();assert.equal(reset.states[0],'ready');callback('SIGNED_OUT',null);assert.equal(reset.states[0],'ready');
 results.push({finding:'W05',status:'reproduced',observed:'SIGNED_OUT/null leaves reset form ready'});
 const notification=harness('components/customer/CustomerPortalSelfService.tsx',{'@/lib/website/businessDate':{stockholmCalendarDate:()=> '2026-10-07'}},{sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},fetch:async()=>({ok:true,json:async()=>({ok:true,opsSynced:true,localSynced:true,queued:false})})});
 await nodes(notification.render(props)).find(n=>n.type==='button'&&text(n).includes('Markera som läst')).props.onClick();
 assert.equal(notification.states[3].kind,'success');assert.ok(text(notification.render(props)).includes('Senaste meddelandet är oläst.'));
 results.push({finding:'W06',status:'reproduced',observed:'Successful notification read retains unread label and read button'});
 fs.writeFileSync(__dirname+'/reproduction-results.json',JSON.stringify({scope:'Gridex Web only; real TS/TSX handlers, mocked React hooks and external boundaries; no network, email or database writes',results},null,2)+'\n');
 console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
