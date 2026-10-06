// An isolated local application: no fixture routes or synthetic users are shipped.
import { execFileSync, spawn } from 'node:child_process'
import { cp, mkdir, mkdtemp, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { createServer } from 'node:net'
const root=process.cwd(), isolated=await mkdtemp(join(tmpdir(),'gridex-browser-regression-'))
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r))
const origin=`http://127.0.0.1:${port}`
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(f=>f&&!f.startsWith('quality/')&&!f.startsWith('supabase/.temp/'))
for(const file of files){await mkdir(resolve(isolated,file,'..'),{recursive:true});await cp(resolve(root,file),resolve(isolated,file))}
await symlink(resolve(root,'node_modules'),join(isolated,'node_modules'),'dir')
for(const [source,route] of [['price','audit-price'],['customer','audit-customer'],['status','audit-status']]){await mkdir(join(isolated,'app',route),{recursive:true});await cp(join(root,'tests/fixtures/audit-ui',source+'.tsx'),join(isolated,'app',route,'page.tsx'))}
await writeFile(join(isolated,'app/layout.tsx'),`export default function Layout({children}:{children:React.ReactNode}){return <html lang="sv"><body>{children}</body></html>}`)
await writeFile(join(isolated,'next.config.ts'),`export default {reactStrictMode:false,allowedDevOrigins:['127.0.0.1'],experimental:{cpus:2}}`)
const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:'https://audit.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-audit-publishable-key',GRIDEX_AUDIT_ORIGIN:origin}
// Strip inherited real integration credentials from the fixture server.
for(const key of Object.keys(env))if(/^(SUPABASE_SERVICE_ROLE_KEY|GRIDEX_API_KEY|GRIDEX_CUSTOMER_ASSERTION|GRIDEX_SUPPORT_RECEIPT|RESEND_API_KEY)/.test(key))delete env[key]
const server=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:isolated,env,stdio:['ignore','pipe','pipe'],detached:true})
let serverOutput='';server.stdout.on('data',d=>serverOutput+=d);server.stderr.on('data',d=>serverOutput+=d)
const run=file=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[file],{cwd:root,env,stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${file}: ${code}`)))})
try {
 const until=Date.now()+60000
 while(true){try{if((await fetch(origin+'/audit-customer',{signal:AbortSignal.timeout(1000)})).ok)break}catch{} if(Date.now()>until||server.exitCode!==null)throw new Error('Fixture server did not start: '+serverOutput.slice(-2000));await new Promise(r=>setTimeout(r,250))}
 await run('tests/audit-customer-browser.mjs');await run('tests/audit-calculator-browser.mjs');await run('tests/audit-status-browser.mjs')
} finally {try{process.kill(-server.pid,'SIGTERM')}catch{}await new Promise(r=>setTimeout(r,300));await rm(isolated,{recursive:true,force:true})}
