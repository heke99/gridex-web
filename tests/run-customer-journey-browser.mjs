// Real Next routes/components with isolated Auth/OPS/storage ports. No credentials.
import { execFileSync, spawn } from 'node:child_process'
import { cp, mkdir, mkdtemp, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { createServer } from 'node:net'

const root = process.cwd(), isolated = await mkdtemp(join(tmpdir(), 'gridex-customer-journey-'))
const reserve = createServer()
await new Promise(done => reserve.listen(0, '127.0.0.1', done))
const port = reserve.address().port
await new Promise(done => reserve.close(done))
const origin = `http://127.0.0.1:${port}`
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0')
for (const file of files.filter(file => file && !['proxy.ts', 'middleware.ts'].includes(file) && !file.startsWith('app/') && !file.startsWith('apps/') && !file.startsWith('quality/') && !file.startsWith('supabase/'))) {
  await mkdir(resolve(isolated, file, '..'), { recursive: true })
  await cp(resolve(root, file), resolve(isolated, file))
}
await symlink(resolve(root, 'node_modules'), join(isolated, 'node_modules'), 'dir')
for (const route of ['mina-sidor', 'dashboard', 'aktivera-kundkonto']) await cp(join(root, 'app', route), join(isolated, 'app', route), { recursive: true })
// These scenarios do not invoke profile/support actions; avoid registering unrelated forms.
for (const route of ['profile', 'support', 'invoices', 'documents', 'approvals', 'privacy']) await rm(join(isolated, 'app/dashboard', route), { recursive: true, force: true })
await mkdir(join(isolated, 'app/checkout-fixture'), { recursive: true })
await mkdir(join(isolated, 'app/login'), { recursive: true })
await writeFile(join(isolated, 'app/checkout-fixture/page.tsx'), `export {default} from '@/tests/fixtures/customer-checkout'`)
await writeFile(join(isolated, 'app/login/page.tsx'), `export default function Login(){return <h1>Logga in</h1>}`)
await writeFile(join(isolated, 'app/layout.tsx'), `import './globals.css';export default function Layout({children}:{children:React.ReactNode}){return <html lang="sv"><body className="bg-black text-white">{children}</body></html>}`)
await cp(join(root, 'app/globals.css'), join(isolated, 'app/globals.css'))
// Replace external ports only inside the disposable copy. Next's TS path plugin
// resolves these before webpack aliases in some versions.
for (const port of [
  'lib/supabase/server.ts', 'lib/supabase/service.ts', 'lib/ops/client.ts', 'lib/ops/client/customerSupport.ts',
  'lib/customerPortal/onboarding.ts', 'lib/customerPortal/authProfileSync.ts', 'lib/auth/permissions.ts',
]) await cp(join(root, 'tests/fixtures/customer-journey-server.ts'), join(isolated, port))
await writeFile(join(isolated, 'components/auth/AuthSessionSync.tsx'), `'use client';export default function Session(){return null}`)
await writeFile(join(isolated, 'next.config.ts'), `export default {reactStrictMode:false,experimental:{cpus:2}}`)
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'https://audit.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-audit-key', GRIDEX_JOURNEY_ORIGIN: origin }
for (const key of Object.keys(env)) if (/^(SUPABASE_SERVICE_ROLE_KEY|GRIDEX_API_KEY|GRIDEX_CUSTOMER_ASSERTION|GRIDEX_SUPPORT_RECEIPT|RESEND_API_KEY)/.test(key)) delete env[key]
const server = spawn(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: isolated, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
let output = ''
server.stdout.on('data', data => output += data)
server.stderr.on('data', data => output += data)
try {
  const deadline = Date.now() + 60000
  while (true) {
    try { if ((await fetch(origin + '/mina-sidor', { signal: AbortSignal.timeout(1000) })).ok) break } catch {}
    if (Date.now() > deadline || server.exitCode !== null) throw Error(output.slice(-4000))
    await new Promise(done => setTimeout(done, 250))
  }
  // Finish lazy development compilation before attaching a browser. A first
  // compile can otherwise trigger Fast Refresh during an in-flight Firefox nav.
  for (const route of ['/dashboard', '/dashboard/contracts', '/aktivera-kundkonto', '/login', '/checkout-fixture']) {
    const response = await fetch(origin + route, { signal: AbortSignal.timeout(60000) })
    const body = await response.text()
    if (!response.ok) throw Error(`Fixture warm-up failed at ${route}: ${body.slice(-1000)} ${output.slice(-1000)}`)
  }
  await new Promise((done, reject) => {
    const child = spawn(process.execPath, ['tests/customer-journey-browser.mjs'], { cwd: root, env, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', code => code === 0 ? done() : reject(Error(`Customer browser checks failed (${code}): ${output.slice(-1800)}`)))
  })
} finally {
  try { process.kill(-server.pid, 'SIGTERM') } catch {}
  await new Promise(done => setTimeout(done, 300))
  await rm(isolated, { recursive: true, force: true })
}
