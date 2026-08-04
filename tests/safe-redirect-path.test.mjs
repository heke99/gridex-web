import assert from 'node:assert/strict'
import { safeRedirectPath } from '../lib/auth/safeRedirectPath.ts'

assert.equal(safeRedirectPath('/teckna-avtal?checkout=abc'), '/teckna-avtal?checkout=abc')
assert.equal(safeRedirectPath('/login?status=verified&next=%2Fteckna-avtal'), '/login?status=verified&next=%2Fteckna-avtal')
assert.equal(safeRedirectPath('https://evil.example'), '/mina-sidor')
assert.equal(safeRedirectPath('//evil.example'), '/mina-sidor')
assert.equal(safeRedirectPath('/\\evil.example'), '/mina-sidor')
assert.equal(safeRedirectPath('/teckna-avtal\nnext'), '/mina-sidor')
assert.equal(safeRedirectPath(null, '/login'), '/login')

console.log('safe redirect path tests passed')
