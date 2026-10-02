import assert from 'node:assert/strict'
import { isSupportHost, supportRewritePath, isProtectedPage } from '../lib/routing/supportHost.ts'

assert.equal(isSupportHost('SUPPORT123.gridex.se:443'), true)
for (const host of ['gridex.se', 'support123.gridex.se.evil.example', 'app.gridex.se', 'preview.vercel.app']) {
  assert.equal(supportRewritePath(host, '/'), null)
}
assert.equal(supportRewritePath('support123.gridex.se', '/'), '/support-center')
assert.equal(supportRewritePath('support123.gridex.se', '/staff'), '/support-center/staff')
for (const pathname of ['/api/web/customer/me', '/auth/confirm', '/login', '/_next/static/x.js', '/support-center']) {
  assert.equal(supportRewritePath('support123.gridex.se', pathname), null)
}
for (const pathname of ['/support-center', '/support-center/staff', '/admin', '/admin/users', '/dashboard/profile', '/mina-sidor']) {
  assert.equal(isProtectedPage(pathname), true)
}
for (const pathname of ['/administrator', '/dashboarding', '/support-center-info', '/', '/api/support/public']) {
  assert.equal(isProtectedPage(pathname), false)
}
console.log('Support host routing and auth boundaries passed')
