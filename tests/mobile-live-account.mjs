import fs from 'node:fs';
import {parseArgs} from 'node:util';
const {values:args}=parseArgs({options:{config:{type:'string'},accounts:{type:'string'},report:{type:'string'}}});
if(!args.config||!args.accounts||!args.report)throw new Error('Required: --config --accounts --report');
import assert from 'node:assert/strict';
import React from '../apps/mobile/node_modules/react/index.js';
import Renderer from '../apps/mobile/node_modules/react-test-renderer/index.js';
import {createClient} from '../node_modules/@supabase/supabase-js/dist/index.mjs';
import {secureSessionStorage} from '../apps/mobile/src/secureSessionStorage.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const cfg=JSON.parse(fs.readFileSync(args.config));
const [account]=JSON.parse(fs.readFileSync(args.accounts));
if(!account.email.startsWith('gridex-mobile-e2e-')||!account.email.endsWith('@example.invalid'))throw new Error('Requires an isolated test identity');
const map=new Map();const storage=secureSessionStorage({getItemAsync:async k=>map.get(k)??null,setItemAsync:async(k,v)=>{map.set(k,v)},deleteItemAsync:async k=>{map.delete(k)}},'gridex-live-test');
const client=createClient(cfg.NEXT_PUBLIC_SUPABASE_URL,cfg.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{storage,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
const listeners=new Set();const appState={currentState:'active',addEventListener:(_,f)=>{listeners.add(f);return{remove:()=>listeners.delete(f)}}};
globalThis.__mobileFixture={client,appState};
const {useCustomerAccount}=await import('../apps/mobile/src/useCustomerAccount.ts');
let current;function Probe(){current=useCustomerAccount('gridex-live-test');return null}
const {act}=Renderer;const checks=[];function pass(name){checks.push({name,passed:true});console.log(name)}
let view;
try{
 await act(async()=>{view=Renderer.create(React.createElement(Probe))});
 await act(async()=>{await current.login(account.email,account.password)});
 assert.equal(current.authenticated,true);assert.deepEqual(current.rows,[]);assert.equal(current.error,'');pass('Native hook: real login and empty own contracts');
 assert.ok(map.size>0);pass('Real session persisted through chunked storage adapter; memory backing only');
 await act(async()=>{appState.currentState='background';for(const f of listeners)f('background')});assert.equal(current.rows,null);assert.equal(current.active,false);pass('Background clears private rows');
 await act(async()=>{appState.currentState='active';for(const f of listeners)f('active')});
 for(let i=0;i<45&&current.busy;i++)await act(async()=>{await new Promise(r=>setTimeout(r,1000))});
 assert.equal(current.authenticated,true);assert.deepEqual(current.rows,[]);assert.equal(current.error,'');pass('Foreground revalidates real session and rereads own contracts');
 await act(async()=>{view.unmount()});
 await act(async()=>{view=Renderer.create(React.createElement(Probe))});
 for(let i=0;i<45&&current.busy;i++)await act(async()=>{await new Promise(r=>setTimeout(r,1000))});
 assert.equal(current.authenticated,true);assert.deepEqual(current.rows,[]);pass('Hook remount restores and refreshes persisted real session');
 await act(async()=>{current.logout()});
 for(let i=0;i<45&&current.busy;i++)await act(async()=>{await new Promise(r=>setTimeout(r,1000))});
 assert.equal(current.authenticated,false);assert.equal(current.rows,null);assert.equal(map.size,0);pass('Logout clears session storage and customer rows');
}catch(e){checks.push({name:'Native live journey',passed:false,error:e.message});console.log(JSON.stringify(checks.at(-1)));process.exitCode=1}
finally{if(view)await act(async()=>view.unmount());await client.auth.signOut({scope:'local'});fs.writeFileSync(args.report,JSON.stringify({checks,nativeDeviceVerified:false,storageBacking:'in-memory SecureStore port',realAuth:true,realMobileApi:true},null,2));}
