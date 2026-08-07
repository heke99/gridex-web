import fs from 'node:fs'
import path from 'node:path'

const testsDir = path.resolve('tests')
const helperImport = "import { readOpsClientImplementation } from './ops-client-source.mjs'"
const helperMarker = 'readOpsClientImplementation'
const skipFiles = new Set([
  'ops-client-source.mjs',
  'gridex-runtime-hardening.test.mjs',
  'checkout-post-commit-durability.test.mjs',
  'public-contract-cache-durability.test.mjs',
])

const candidates = fs.readdirSync(testsDir)
  .filter((name) => name.endsWith('.mjs') && !skipFiles.has(name))
  .sort()

const sourceReadPatterns = [
  /\bread\(\s*(['"])lib\/ops\/client\.ts\1\s*\)/g,
  /\bfs\.readFileSync\(\s*(['"])lib\/ops\/client\.ts\1\s*,\s*(['"])utf8\2\s*\)/g,
  /\breadFileSync\(\s*(['"])lib\/ops\/client\.ts\1\s*,\s*(['"])utf8\2\s*\)/g,
]

let changed = 0
for (const name of candidates) {
  const filePath = path.join(testsDir, name)
  const source = fs.readFileSync(filePath, 'utf8')
  let next = source

  for (const pattern of sourceReadPatterns) {
    next = next.replace(pattern, 'readOpsClientImplementation()')
  }

  if (next === source) continue
  if (!next.includes(helperMarker)) {
    throw new Error(`Internal rewrite error: ${name} has no helper reference.`)
  }
  if (!source.includes(helperImport) && !next.includes(helperImport)) {
    next = `${helperImport}\n${next}`
  }

  fs.writeFileSync(filePath, next)
  changed += 1
  console.log(`Updated split-client source assertions: tests/${name}`)
}

console.log(`Split-client source assertion migration complete (${changed} file(s) changed).`)
