import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { AsyncLocalStorage } from 'node:async_hooks'
import { isSupportHost, supportRewritePath, isProtectedPage } from '../lib/routing/supportHost.ts'

assert.equal(isSupportHost('SUPPORT123.gridex.se:443'), true)
for (const host of ['gridex.se', 'support123.gridex.se.evil.example', 'app.gridex.se', 'preview.vercel.app']) {
  assert.equal(supportRewritePath(host, '/'), null)
}
assert.equal(supportRewritePath('support123.gridex.se', '/'), '/staff')
for (const pathname of ['/staff', '/staff/login', '/staff/recovery', '/staff/verify', '/api/staff/session', '/api/staff/customers']) {
  assert.equal(supportRewritePath('support123.gridex.se', pathname), null)
}
for (const pathname of ['/api/web/customer/me', '/auth/confirm', '/login', '/register', '/support-center', '/dashboard/support', '/kundservice', '/staff/register']) {
  assert.equal(supportRewritePath('support123.gridex.se', pathname), '/staff/login')
}
assert.equal(supportRewritePath('support123.gridex.se', '/login/recovery'), '/staff/recovery')
for (const pathname of ['/support-center', '/support-center/staff', '/admin', '/admin/users', '/dashboard/profile', '/mina-sidor']) {
  assert.equal(isProtectedPage(pathname), true)
}
for (const pathname of ['/administrator', '/dashboarding', '/support-center-info', '/', '/api/support/public']) {
  assert.equal(isProtectedPage(pathname), false)
}
const state = globalThis.__gridexStaffHost = { authReads: 0, user: null }
globalThis.AsyncLocalStorage ??= AsyncLocalStorage
const { NextRequest } = await import('next/server.js')
const { unstable_doesMiddlewareMatch } = await import('next/experimental/testing/server.js')
const ssr = `data:text/javascript,${encodeURIComponent(`export function createServerClient() { return {auth:{getUser:async()=>{ const state=globalThis.__gridexStaffHost; state.authReads++; return {data:{user:state.user}} }}} }`)}`
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === '@supabase/ssr') return { url: ssr, shortCircuit: true }
  if (specifier === 'next/server') return nextResolve('next/server.js', context)
  if (specifier === '@/lib/routing/supportHost') return nextResolve(new URL('../lib/routing/supportHost.ts', import.meta.url).href, context)
  return nextResolve(specifier, context)
} })
try {
  const { proxy, config } = await import('../proxy.ts')
  const request = (host, path, method = 'GET') => new NextRequest(`https://${host}${path}`, {
    method, headers: { host, cookie: 'customer_session=must-not-use', 'x-gridex-staff-mode': 'authenticated' },
    ...(method === 'POST' ? { body: 'email=customer&password=must-not-use' } : {}),
  })
  for (const path of ['/', '/register', '/login?next=%2Fregister', '/kundservice', '/support-center', '/dashboard/support', '/auth/confirm?token_hash=private']) {
    const response = await proxy(request('support123.gridex.se', path))
    const target = new URL(response.headers.get('x-middleware-rewrite'))
    assert.equal(target.pathname, path === '/' ? '/staff' : '/staff/login')
    assert.equal(target.search, '', 'Customer callback/redirect data never reaches staff entry')
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive')
    assert.equal(response.headers.get('location'), null, 'Staff frontend stays in Web, without native OPS redirects')
    assert.equal(response.headers.get('x-middleware-request-x-gridex-staff-mode'), null)
    const post = await proxy(request('support123.gridex.se', path, 'POST'))
    assert.equal(post.status, 403, 'Customer/server-action writes are blocked before rendering/Auth')
  }
  assert.equal((await proxy(request('support123.gridex.se', '/api/staff/session/login', 'POST'))).headers.get('x-middleware-next'), '1')
  for (const path of ['/login.js', '/staff/login.js', '/missing.css', '/favicon.ico', '/favicon.ico/extra', '/icon.svg/extra',
    '/_next/static/missing.js', '/_next/staticevil', '/_next/image', '/_next/image/evil', '/brand/missing', '/brand/missing.svg']) {
    assert.equal(unstable_doesMiddlewareMatch({ config, url: `https://support123.gridex.se${path}` }), true, 'Actual matcher covers every action-capable path')
    for (const method of ['POST', 'PUT', 'DELETE']) assert.equal((await proxy(request('support123.gridex.se', path, method))).status, 403, 'Asset-looking mutation cannot skip staff boundary')
  }
  for (const path of ['/_next/static/chunks/app.js', '/_next/image?url=%2Ficon.png&w=64&q=75', '/icon.svg', '/icon.png', '/brand/gridex-mark.svg']) {
    for (const method of ['GET', 'HEAD']) assert.equal((await proxy(request('support123.gridex.se', path, method))).headers.get('x-middleware-next'), '1', 'Real read-only assets remain available')
  }
  assert.equal(state.authReads, 0, 'Staff host never enters Web customer authentication')
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic'
  for (const path of ['/support-center', '/dashboard/support']) {
    state.user = null
    const anonymous = await proxy(request('gridex.se', path))
    assert.equal(new URL(anonymous.headers.get('location')).pathname, '/login')
    state.user = { id: 'verified-customer' }
    assert.equal((await proxy(request('gridex.se', path))).headers.get('x-middleware-next'), '1')
  }
  assert.equal((await proxy(request('gridex.se', '/register'))).headers.get('x-middleware-next'), '1')
  assert.equal((await proxy(request('gridex.se', '/staff'))).status, 404)
  assert.equal((await proxy(request('gridex.se', '/api/staff/customers'))).status, 404)
  assert.equal((await proxy(request('support123.gridex.se.evil.example', '/register'))).headers.get('x-middleware-next'), '1')
  console.log('Actual staff host rewrites, server-action denial, spoofed routing-header removal and main customer routing passed')
} finally { hooks.deregister() }
