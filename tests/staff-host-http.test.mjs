import assert from 'node:assert/strict'
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)), '..')
// This isolated test cannot use an ambient production/customer API credential.
delete process.env.GRIDEX_API_KEY
delete process.env.GRIDEX_STAFF_API_KEY
// Next CLI pins initURL to localhost; a custom production handler mirrors the
// trusted virtual host supplied by a hosting front end without editing config.
const {default:next}=await import(root+'/node_modules/next/dist/server/next.js');const app=next({dev:false,dir:root,conf:{experimental:{cpus:4,trustHostHeader:true}}});await app.prepare();const server=http.createServer(app.getRequestHandler());await new Promise(resolve=>server.listen(3006,'127.0.0.1',resolve))
const request=(host,path)=>new Promise((resolve,reject)=>{http.get({hostname:'127.0.0.1',port:3006,path,headers:{Host:host}},response=>{let body='';response.on('data',chunk=>body+=chunk);response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body}))}).on('error',reject)})
const {encodeReply}=createRequire(import.meta.url)('next/dist/compiled/react-server-dom-webpack/client.node')
const actionManifest=JSON.parse(readFileSync(resolve(root,'.next/server/server-reference-manifest.json'),'utf8'))
const loginAction=Object.entries(actionManifest.node).find(([,entry])=>entry.exportedName==='loginWithPassword'&&Object.hasOwn(entry.workers,'app/login/page'))?.[0]
assert.ok(loginAction,'Built native customer login action exists; regression cannot pass by omitting it')
const emptyForm=new FormData();emptyForm.set('email','');emptyForm.set('password','')
const encoded=new Request('http://127.0.0.1',{method:'POST',body:await encodeReply([emptyForm])})
const actionBytes=Buffer.from(await encoded.arrayBuffer())
const actionRequest=(host,path)=>new Promise((resolve,reject)=>{const incoming=http.request({hostname:'127.0.0.1',port:3006,path,method:'POST',headers:{Host:host,Origin:`https://${host}`,'Content-Type':encoded.headers.get('content-type'),'Content-Length':String(actionBytes.length),'Next-Action':loginAction}},response=>{let body='';response.on('data',chunk=>body+=chunk);response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body}))});incoming.on('error',reject);incoming.end(actionBytes)})
try{
 for(let i=0;i<80;i++){try{await request('gridex.se','/');break}catch(error){if(i===79)throw error;await new Promise(resolve=>setTimeout(resolve,100))}}
 for(const [host,path,name] of [['support123.gridex.se','/','support-root'],['support123.gridex.se','/login','support-login'],['support123.gridex.se','/register','support-register'],['support123.gridex.se','/dashboard/support','support-customer-path'],['gridex.se','/','main-home'],['gridex.se','/login','main-login']]){
  const result=await request(host,path)
  const staff=host.startsWith('support123');assert.equal(result.status,200,name)
  assert.equal(result.body.includes('gridex-google-consent-defaults'),!staff,name+' consent')
  assert.equal(result.body.includes('<footer'),!staff,name+' footer')
  if(staff){assert.ok(result.body.includes('Gridex arbetsyta'));assert.equal(result.headers['x-robots-tag'],'noindex, nofollow, noarchive');assert.match(result.headers['cache-control'],/no-store/)}
  console.log(JSON.stringify({name,status:result.status,marketingConsent:result.body.includes('gridex-google-consent-defaults'),footer:result.body.includes('<footer'),staff:result.body.includes('Gridex arbetsyta'),cache:result.headers['cache-control']}))
 }
 for(const path of ['/login','/login.js','/staff/login.js','/missing.css','/_next/static/missing.js','/_next/staticevil','/_next/image','/_next/image/evil','/favicon.ico','/favicon.ico/extra','/icon.svg','/icon.svg/extra','/brand/missing','/brand/missing.svg']){
  const result=await actionRequest('support123.gridex.se',path)
  assert.equal(result.status,403,path+' must refuse actual server action before native dispatch')
  assert.equal(JSON.parse(result.body).error.code,'staff_route_forbidden',path)
  assert.equal(result.headers['x-action-redirect'],undefined,path+' must not execute native invalid-login redirect')
 }
 const nativeControl=await actionRequest('gridex.se','/login')
 assert.equal(nativeControl.status,200,'Main native login action remains callable')
 assert.match(nativeControl.headers['x-action-redirect']||'',/^\/login\?error=/,'Empty main login reaches its original validation redirect without calling a provider')
 for(const path of ['/icon.svg','/brand/gridex-mark.svg']){
  const asset=await request('support123.gridex.se',path)
  assert.equal(asset.status,200,path+' actual asset remains readable')
  assert.match(asset.headers['content-type'],/image\/svg\+xml/)
  assert.ok(!asset.body.includes('Gridex arbetsyta'))
 }

 console.log('Production-build virtual-host HTTP proof passed: staff-only bare shell, actual native Next-Action denied on page/extension/asset paths, real assets readable, unchanged main action/chrome/cache')
}finally{server.close();await app.close()}
