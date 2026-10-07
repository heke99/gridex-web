import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { webcrypto } from 'node:crypto'
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
function text(tree) { if(typeof tree==='string')return tree; if(!tree||typeof tree!=='object')return ''; return [tree.props?.children].flat(Infinity).map(text).join(' '); }
(async()=>{
 let password;
 const actions=harness('app/dashboard/profile/actions.ts',{
  'next/cache':{revalidatePath(){}},'next/navigation':{redirect:path=>{throw Error('REDIRECT '+path)}},
  '@/lib/supabase/server':{createSupabaseServerActionClient:async()=>({auth:{updateUser:async payload=>{password=payload.password;return {error:null}}}})},
  '@/lib/ops/client':{},'@/lib/customerPortal/service':{},'@/lib/supabase/service':{},
  '@/lib/auth/passwordPolicy':{passwordMeetsPolicy:p=>p.length>=8&&/[A-Z]/.test(p)&&/[0-9]/.test(p)&&/[^A-Za-z0-9]/.test(p),PASSWORD_REQUIREMENT_TEXT:'policy'}
 });
 const entered=' Abcdef12! ';
 await assert.rejects(actions.exports.updateCustomerPasswordAction({get:()=>entered}),/REDIRECT/);
 assert.equal(password,'Abcdef12!');assert.notEqual(password,entered);
 results.push({finding:'W07',observed:'Profile password action strips leading and trailing spaces before Auth update'});
 let forwarded;
 const invoice=harness('app/api/web/customer/invoices/[id]/route.ts',{
  '@/lib/api/webBoundary':{webErrorResponse:()=>({status:400})},
  '@/lib/customerPortal/resourceRoute':{customerResourceResponse:async(_,id)=>{forwarded=id;return {status:200}}}
 });
 await invoice.exports.GET({}, {params:Promise.resolve({id:'invoice%2Fpart'})});assert.equal(forwarded,'invoice/part');
 await assert.rejects(invoice.exports.GET({}, {params:Promise.resolve({id:'invoice%reference'})}),/URI malformed/);
 results.push({finding:'W08',observed:'Already-decoded opaque reference is decoded again; literal percent throws outside error boundary'});
 const records=[{id:'synthetic',title:'Test',created_at:'2026-10-07T22:30:00Z',status:'available'}];
 const docs=harness('app/dashboard/documents/page.tsx',{
  '@/components/customer/EventLink':{default:'a'},'@/lib/customerPortal/service':{getCanonicalCustomerResource:async()=>({data:records})}
 });
 const tree=await docs.exports.default();assert.ok(text(tree).includes('2026-10-07'));
 const stockholm=new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Europe/Stockholm'}).format(new Date(records[0].created_at));
 assert.equal(stockholm,'2026-10-08');
 results.push({finding:'W09',observed:'UTC runtime renders 2026-10-07 for timestamp whose Swedish calendar date is 2026-10-08'});
 records[0].created_at='invalid-date';await assert.rejects(docs.exports.default(),/Invalid time value/);
 results.push({finding:'W10',observed:'One malformed document date rejects whole page render instead of showing a fallback'});
 let fallback=0,callback=0;
 const link=harness('components/customer/EventLink.tsx',{}, {navigator:{sendBeacon:()=>false},Blob,fetch:async()=>{fallback++;}});
 link.render({href:'https://example.invalid',eventType:'customer.opened_document',children:'Test',onClick:()=>callback++}).props.onClick({});
 assert.equal(fallback,0);assert.equal(callback,1);
 results.push({finding:'W11',observed:'sendBeacon=false silently loses event; fetch fallback never runs'});
 fs.writeFileSync(__dirname+'/additional-results.json',JSON.stringify({scope:'Real Web handlers/render functions with mocked external boundaries; TZ=UTC; no network or production writes',results},null,2)+'\n');
 console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
