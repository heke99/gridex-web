// Real Next server rendering and Link scheduling, with an offline Auth adapter.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cp, mkdir, mkdtemp, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { chromium } from 'playwright'

const root = process.cwd(), isolated = await mkdtemp(join(tmpdir(), 'gridex-performance-browser-'))
const reserve = createServer()
await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve))
const port = reserve.address().port
await new Promise(resolve => reserve.close(resolve))
const origin = `http://127.0.0.1:${port}`
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SUPABASE_URL: 'https://performance.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-public-key' }
for (const key of Object.keys(env)) if (/^(SUPABASE_SERVICE_ROLE_KEY|GRIDEX_API_KEY|GRIDEX_CUSTOMER_ASSERTION|GRIDEX_SUPPORT_RECEIPT|RESEND_API_KEY)/.test(key)) delete env[key]
let output = '', server, browser
const run = args => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), ...args], { cwd: isolated, env, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', data => { output += data }); child.stderr.on('data', data => { output += data })
  child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(output.slice(-5000))))
})
try {
  await mkdir(join(isolated, 'app'), { recursive: true })
  await symlink(join(root, 'node_modules'), join(isolated, 'node_modules'), 'dir')
  await cp(join(root, 'lib/supabase/server.ts'), join(isolated, 'server.ts'))
  await cp(join(root, 'components/navigation/IntentLink.tsx'), join(isolated, 'IntentLink.tsx'))
  await writeFile(join(isolated, 'package.json'), JSON.stringify({ name: 'gridex-offline-performance-fixture', private: true }))
  // Bind the mock counter to the client, retaining the real production helper.
  await writeFile(join(isolated, 'auth-adapter.js'), `
    export function createServerClient(_url,_key,options) {
      const user = options.cookies.get('perf-user') ?? 'guest';
      const client = { authReads:0, auth:{ async getUser(){
        client.authReads++; await new Promise(resolve=>setTimeout(resolve,5));
        return {data:{user:user==='guest'||user==='expired'?null:{id:user}},error:user==='expired'?new Error('Expired auth'):null};
      }}}; return client;
    }
  `)
  await writeFile(join(isolated, 'next.config.ts'), `import path from 'node:path'; export default {experimental:{cpus:2},webpack(config){config.resolve.alias['@supabase/ssr']=path.resolve(process.cwd(),'auth-adapter.js');return config}}`)
  await writeFile(join(isolated, 'app/layout.tsx'), `export default function Layout({children}:{children:React.ReactNode}){return <html lang="sv"><body>{children}</body></html>}`)
  await writeFile(join(isolated, 'app/page.tsx'), `
    import {createSupabaseServerClient,getVerifiedServerUser} from '../server';
    import Menu from '../Menu';
    export const dynamic='force-dynamic';
    export default async function Page(){
      const clients=await Promise.all([createSupabaseServerClient(),createSupabaseServerClient(),createSupabaseServerClient()]);
      const users=await Promise.all(clients.map(client=>getVerifiedServerUser(client)));
      const result={clients:new Set(clients).size,authReads:clients.map(client=>(client as unknown as {authReads:number}).authReads),users:users.map(result=>result.data.user?.id??null),errors:users.map(result=>Boolean(result.error))};
      return <><pre data-testid="session">{JSON.stringify(result)}</pre><Menu/></>;
    }
  `)
  await writeFile(join(isolated, 'Menu.tsx'), `
    'use client';import {useState} from 'react';import IntentLink from './IntentLink';
    export default function Menu(){const [href,setHref]=useState('/destination');const [events,setEvents]=useState(0);
      return <><IntentLink href={href} onFocus={()=>setEvents(value=>value+1)} onMouseEnter={()=>setEvents(value=>value+1)}>Destination</IntentLink>
      <button onClick={()=>setHref('/other')}>Change target</button><output data-testid="events">{events}</output></>;
    }
  `)
  for (const route of ['destination', 'other']) {
    await mkdir(join(isolated, 'app', route), { recursive: true })
    await writeFile(join(isolated, 'app', route, 'page.tsx'), `export default function Page(){return <h1>${route}</h1>}`)
  }
  await run(['build', '--webpack'])
  server = spawn(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: isolated, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
  server.stdout.on('data', data => { output += data }); server.stderr.on('data', data => { output += data })
  const deadline = Date.now() + 30_000
  while (true) {
    try { if ((await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok) break } catch {}
    if (Date.now() > deadline || server.exitCode !== null) throw new Error(output.slice(-5000))
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  browser = await chromium.launch({ headless: true })
  // Concurrent requests must not share sessions; repeated reads in one RSC do.
  const identities = ['alice', 'bob', 'alice', 'guest', 'expired']
  await Promise.all(identities.map(async identity => {
    const response = await fetch(origin, { headers: { cookie: `perf-user=${identity}` } })
    const html = await response.text()
    const encoded = html.match(/<pre data-testid="session">([^<]+)<\/pre>/)?.[1]
    assert.ok(encoded)
    const result = JSON.parse(encoded.replaceAll('&quot;', '"'))
    assert.equal(result.clients, 1)
    assert.deepEqual(result.authReads, [1, 1, 1])
    assert.deepEqual(result.users, Array(3).fill(identity === 'guest' || identity === 'expired' ? null : identity))
    assert.deepEqual(result.errors, Array(3).fill(identity === 'expired'))
  }))
  const page = await browser.newPage()
  const requests = []
  page.on('request', request => { const url = new URL(request.url()); if (url.searchParams.has('_rsc')) requests.push(url.pathname) })
  await page.goto(origin, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  assert.deepEqual(requests, [], 'visible menus must not prefetch without intent')
  await page.getByRole('link', { name: 'Destination' }).hover()
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="events"]').textContent) > 0)
  await assertEventually(() => requests.includes('/destination'))
  await page.getByRole('button', { name: 'Change target' }).click()
  const beforeChange = requests.length
  await page.waitForTimeout(400)
  assert.equal(requests.length, beforeChange, 'changed href requires fresh intent')
  await page.getByRole('link', { name: 'Destination' }).focus()
  await assertEventually(() => requests.includes('/other'))
  await page.getByRole('link', { name: 'Destination' }).click()
  await page.getByRole('heading', { name: 'other', exact: true }).waitFor()
  console.log('PASS: real Next RSC deduplicates 3 Auth reads to 1, isolates concurrent customers, preserves guests/expired errors; menu idle/hover/focus/changed-href/navigation checks pass')
} finally {
  await browser?.close()
  if (server) { try { process.kill(-server.pid, 'SIGTERM') } catch {} }
  await rm(isolated, { recursive: true, force: true })
}
async function assertEventually(predicate) {
  const deadline = Date.now() + 5_000
  while (!predicate()) {
    if (Date.now() > deadline) assert.fail('Expected route prefetch did not occur')
    await new Promise(resolve => setTimeout(resolve, 50))
  }
}
