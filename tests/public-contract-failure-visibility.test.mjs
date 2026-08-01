import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const home = read('app/(public)/page.tsx')
assert.match(home, /let contractsLoadError: string \| null = null/)
assert.match(home, /contractsLoadError = `Elavtalen kunde inte hämtas just nu\. Supportreferens:/)
assert.match(home, /feed_loaded_with_blocked_contracts/)
assert.match(home, /Publicerade elavtal kan inte visas just nu\. Supportreferens:/)
assert.match(home, /contractsLoadError=\{contractsLoadError\}/)

const contractsPage = read('app/(public)/elavtal/page.tsx')
assert.match(contractsPage, /let blockedFeed = false/)
assert.match(contractsPage, /Supportreferens:/)
assert.match(contractsPage, /!loadError && !blockedFeed && contracts.length === 0/)

const calculator = read('components/ElectricityCalculator.tsx')
assert.match(calculator, /contractsLoadError\?: string \| null/)
assert.match(calculator, /contractsLoadError = null/)
assert.match(calculator, /contractsLoadError \?\? "Det finns inga aktuella elavtal/)

console.log('public-contract failure visibility tests passed')
