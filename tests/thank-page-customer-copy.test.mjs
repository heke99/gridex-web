import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const thanks = read('app/(public)/teckna-avtal/tack/SignupThanksPage.tsx')
const applicationCard = read('components/signup/ApplicationStatusCard.tsx')

for (const internalCopy of [
  'fryst PDF',
  'Information från handläggningen',
  'Uppgifter som kan behöva kompletteras',
  'address_without_grid_area',
  '{stored.nextActionMessage}',
  'OPS fortsätter automatiskt',
]) {
  assert.equal(thanks.includes(internalCopy), false, `customer thank page must not expose: ${internalCopy}`)
}

assert.ok(thanks.includes('PDF-kopia av avtalet'))
assert.ok(thanks.includes('Gridex hanterar de uppgifter som krävs för leverantörsbytet. Vi kontaktar dig endast om vi behöver något från dig.'))
assert.equal(thanks.includes('stored.missingFields'), false)
assert.equal(thanks.includes('stored.blockingReasons'), false)
assert.equal(thanks.includes('stored.warnings'), false)
assert.equal(applicationCard.includes('Nästa steg: {status.next_step}'), false)
assert.equal(applicationCard.includes('{status.next_step}'), false)
assert.equal(applicationCard.includes('{status.blocking_reason}'), false)
assert.ok(applicationCard.includes('Vi behöver en komplettering från dig. Kontrollera din e-post eller Mina sidor.'))

console.log('Thank-page customer copy checks passed')
