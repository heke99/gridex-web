import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync, statSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const state = globalThis.__gridexNativeHostBoundary = { host: 'support123.gridex.se', forwardedHost: null, cookies: 0, providers: 0, redirects: [] }
const fixture = source => `data:text/javascript,${encodeURIComponent(source)}`
const mocks = {
  'next/headers': fixture(`export async function headers(){const s=globalThis.__gridexNativeHostBoundary;return new Headers({host:s.host,...(s.forwardedHost?{'x-forwarded-host':s.forwardedHost}:{})})} export async function cookies(){globalThis.__gridexNativeHostBoundary.cookies++;return {get:()=>undefined,set:()=>{}}}`),
  'next/navigation': fixture(`export function redirect(path){globalThis.__gridexNativeHostBoundary.redirects.push(path);throw new Error('MAIN_NATIVE_REDIRECT')}`),
  '@supabase/ssr': fixture(`export function createServerClient(){globalThis.__gridexNativeHostBoundary.providers++;return {auth:{getUser:async()=>{throw new Error('Unexpected provider request')}}}}`),
  '@/lib/auth/permissions': fixture(`export async function loadUserPermissionsWithClient(){throw new Error('Unexpected permissions request')}`),
  '@/lib/customerPortal/onboardingResume': fixture(`export async function resumePortalOnboardingForConfirmedUserSafely(){throw new Error('Unexpected customer operation')}`),
}
function existing(candidate) {
  return (extname(candidate) ? [candidate] : [candidate, `${candidate}.ts`, `${candidate}.js`]).find(path => existsSync(path) && statSync(path).isFile())
}
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true }
  if (specifier.startsWith('@/')) { const path = existing(resolve(root, specifier.slice(2))); if (path) return { url: pathToFileURL(path).href, shortCircuit: true } }
  if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) { const path = existing(resolve(dirname(fileURLToPath(context.parentURL)), specifier)); if (path) return { url: pathToFileURL(path).href, shortCircuit: true } }
  return nextResolve(specifier, context)
} })
try {
  const { createSupabaseServerClient, createSupabaseServerActionClient } = await import('../lib/supabase/server.ts')
  const { loginWithPassword } = await import('../app/login/actions.ts')
  for (const [host, forwardedHost] of [['support123.gridex.se', null], ['SUPPORT123.gridex.se:443', null], ['localhost:3006', 'support123.gridex.se']]) {
    state.host = host; state.forwardedHost = forwardedHost
    await assert.rejects(createSupabaseServerClient(), /Customer authentication is unavailable on the staff host/)
    await assert.rejects(createSupabaseServerActionClient(), /Customer authentication is unavailable on the staff host/)
    await assert.rejects(loginWithPassword(new FormData()), /Customer authentication is unavailable on the staff host/)
  }
  assert.equal(state.providers, 0, 'Staff requests cannot construct a native customer Auth client')
  assert.equal(state.cookies, 0, 'Staff requests cannot read or mutate customer cookies')
  assert.deepEqual(state.redirects, [], 'Guard precedes even native invalid-input login redirects')
  state.host = 'gridex.se'; state.forwardedHost = null
  await assert.rejects(loginWithPassword(new FormData()), /MAIN_NATIVE_REDIRECT/)
  assert.match(state.redirects[0], /^\/login\?error=/)
  assert.equal(state.providers, 0, 'Empty main login control exits before provider construction')
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://synthetic.supabase.test'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-anonymous-key'
  await createSupabaseServerClient(); await createSupabaseServerActionClient()
  assert.equal(state.providers, 2, 'Normal main-host native factories remain available')
  assert.equal(state.cookies, 2)
  console.log('Actual native customer login and shared read/write Auth factories reject staff host before validation/cookies/provider; main behavior retained')
} finally { hooks.deregister() }
