// Disposable real Next application; external requests are browser-intercepted.
import { execFileSync, spawn } from 'node:child_process'
import { cp, mkdir, mkdtemp, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { createServer } from 'node:net'

const root = process.cwd(), isolated = await mkdtemp(join(tmpdir(), 'gridex-area-comparison-'))
const reserve = createServer()
await new Promise(done => reserve.listen(0, '127.0.0.1', done))
const port = reserve.address().port
await new Promise(done => reserve.close(done))
const origin = `http://127.0.0.1:${port}`
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0')
for (const file of files.filter(file => file && !['proxy.ts', 'middleware.ts'].includes(file) && !/^(app|apps|quality|supabase)\//.test(file))) {
  await mkdir(resolve(isolated, file, '..'), { recursive: true })
  await cp(resolve(root, file), resolve(isolated, file))
}
await symlink(resolve(root, 'node_modules'), join(isolated, 'node_modules'), 'dir')
for (const [route, module] of [['area-comparison', 'default'], ['restored-comparison', 'RestoredComparison']]) {
  await mkdir(join(isolated, 'app', route), { recursive: true })
  await writeFile(join(isolated, 'app', route, 'page.tsx'), `export {${module} as default} from '@/tests/fixtures/area-comparison'`)
}
await cp(join(root, 'app/globals.css'), join(isolated, 'app/globals.css'))
await writeFile(join(isolated, 'app/layout.tsx'), `import './globals.css';export default function Layout({children}:{children:React.ReactNode}){return <html lang="sv" data-scroll-behavior="smooth"><body className="bg-black text-white">{children}</body></html>}`)
await writeFile(join(isolated, 'next.config.ts'), `export default {reactStrictMode:false,experimental:{cpus:2}}`)
const env = { ...process.env, GRIDEX_AREA_ORIGIN: origin }
for (const key of Object.keys(env)) if (/^(SUPABASE_SERVICE_ROLE_KEY|GRIDEX_API_KEY|GRIDEX_CUSTOMER_ASSERTION|GRIDEX_SUPPORT_RECEIPT|RESEND_API_KEY)/.test(key)) delete env[key]
const server = spawn(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: isolated, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
let output = ''
server.stdout.on('data', data => output += data)
server.stderr.on('data', data => output += data)
try {
  const deadline = Date.now() + 60000
  while (true) {
    try { const response = await fetch(origin + '/area-comparison', { signal: AbortSignal.timeout(1000) }); await response.text(); if (response.ok) break } catch {}
    if (Date.now() > deadline || server.exitCode !== null) throw Error(output.slice(-4000))
    await new Promise(done => setTimeout(done, 250))
  }
  const response = await fetch(origin + '/restored-comparison', { signal: AbortSignal.timeout(60000) })
  await response.text()
  if (!response.ok) throw Error(output.slice(-3000))
  await new Promise((done, reject) => {
    const child = spawn(process.execPath, ['tests/area-comparison-browser.mjs'], { cwd: root, env, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', code => code === 0 ? done() : reject(Error(`Area comparison failed (${code}): ${output.slice(-1800)}`)))
  })
} finally {
  try { process.kill(-server.pid, 'SIGTERM') } catch {}
  await new Promise(done => setTimeout(done, 300))
  await rm(isolated, { recursive: true, force: true })
}
