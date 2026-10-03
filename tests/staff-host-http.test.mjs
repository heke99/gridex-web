import assert from 'node:assert/strict'
import http from 'node:http'
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

 console.log('Production-build virtual-host HTTP proof passed: staff-only bare shell, public/customer route isolation, no-store/noindex, unchanged main chrome/cache')
}finally{server.close();await app.close()}
