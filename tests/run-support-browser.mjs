import { generateKeyPairSync } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { resolve } from 'node:path'
import { FIXTURE_COMPANY, FIXTURE_PUBLIC_SERVICE_KEY } from './fixtures/support-runtime.mjs'

// Fresh synthetic state and signing keys for each run. Nothing is provisioned
// in Supabase and the preloaded boundary blocks outbound production requests.
const output = process.env.SUPPORT_BROWSER_OUTPUT ?? '/tmp/gridex-support-browser-evidence'
await mkdir(output, { recursive: true })
const socket = createServer()
socket.listen(0, '127.0.0.1')
await once(socket, 'listening')
const port = socket.address().port
await new Promise((done, reject) => socket.close(error => error ? reject(error) : done()))
const origin = `http://127.0.0.1:${port}`
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const env = {
  ...process.env,
  SUPPORT_TEST_MODE: '1',
  SUPPORT_TEST_PUBLIC_KEY: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  GRIDEX_SUPPORT_SUPABASE_URL: 'https://ayiuxjlfazkjmmtlvhsl.supabase.co',
  GRIDEX_SUPPORT_SUPABASE_ANON_KEY: 'sb_publishable_offline_support_key_123456',
  GRIDEX_SUPPORT_SUPABASE_SERVICE_KEY: FIXTURE_PUBLIC_SERVICE_KEY,
  GRIDEX_STAFF_API_KEY: 'support-test-only-dedicated-key-1234567890',
  GRIDEX_STAFF_COMPANY_ID: FIXTURE_COMPANY,
  GRIDEX_STAFF_API_PROJECT_REF: 'piidsfebjqjmnepdpnas',
  GRIDEX_STAFF_ASSERTION_ISSUER: 'https://support123.gridex.se',
  GRIDEX_STAFF_ASSERTION_AUDIENCE: 'gridex-staff',
  GRIDEX_STAFF_ASSERTION_KID: 'offline-support-key',
  GRIDEX_STAFF_ASSERTION_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  NODE_OPTIONS: `--import ${resolve('tests/fixtures/support-runtime.mjs')}`,
}
const log = createWriteStream(`${output}/offline-runtime.log`)
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', 'apps/support', '--hostname', '127.0.0.1', '--port', String(port)], { env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
server.stdout.pipe(log, { end: false })
server.stderr.pipe(log, { end: false })
let stopped = false
const stop = () => {
  if (stopped) return
  stopped = true
  try { process.kill(-server.pid, 'SIGTERM') } catch (error) { if (error.code !== 'ESRCH') throw error }
}
process.once('SIGINT', stop)
process.once('SIGTERM', stop)
try {
  const deadline = Date.now() + 45_000
  let ready = false
  while (Date.now() < deadline && !stopped && server.exitCode === null) {
    try { ready = (await fetch(`${origin}/login`, { signal: AbortSignal.timeout(1000) })).ok } catch { /* Wait for this owned server. */ }
    if (ready) break
    await new Promise(done => setTimeout(done, 200))
  }
  if (!ready) throw new Error(`Offline support server did not start; see ${output}/offline-runtime.log`)
  const browser = spawn(process.execPath, ['tests/support-browser.mjs'], { stdio: 'inherit', env: { ...process.env, SUPPORT_BROWSER_URL: origin, SUPPORT_BROWSER_OUTPUT: output } })
  const [code] = await once(browser, 'exit')
  if (code !== 0) throw new Error(`Offline browser verification failed (${code})`)
} finally {
  stop()
  if (server.exitCode === null) await Promise.race([once(server, 'exit'), new Promise(done => setTimeout(done, 2000))])
  log.end()
  process.removeListener('SIGINT', stop)
  process.removeListener('SIGTERM', stop)
}
