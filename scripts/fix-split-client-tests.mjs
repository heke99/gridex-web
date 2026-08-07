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

const launchReadBefore = `function read(path) {\n  return readFileSync(new URL(\`../\${path}\`, import.meta.url), "utf8");\n}`
const launchReadAfter = `function read(path) {\n  if (path === "lib/ops/client.ts") return readOpsClientImplementation();\n  return readFileSync(new URL(\`../\${path}\`, import.meta.url), "utf8");\n}`

let changed = 0
for (const name of candidates) {
  const filePath = path.join(testsDir, name)
  const source = fs.readFileSync(filePath, 'utf8')
  let next = source

  for (const pattern of sourceReadPatterns) {
    next = next.replace(pattern, 'readOpsClientImplementation()')
  }

  if (name === 'launch-readiness.test.mjs') {
    if (next.includes(launchReadBefore)) next = next.replace(launchReadBefore, launchReadAfter)
    else if (!next.includes(launchReadAfter)) {
      throw new Error('launch-readiness read helper shape changed; refusing a blind rewrite.')
    }
  }

  if (name === 'website-api.contract.test.mjs') {
    next = next
      .replace(
        "validation.includes('price_area: area.payload.price_area_code')",
        "validation.includes('price_area: area.price_area_code')",
      )
      .replace(
        "validation.includes('grid_area_code: area.payload.grid_area_code')",
        "validation.includes('grid_area_code: area.grid_area_code')",
      )
  }

  if (next === source) continue
  if (next.includes('readOpsClientImplementation()') && !source.includes(helperImport) && !next.includes(helperImport)) {
    next = `${helperImport}\n${next}`
  }
  if (next.includes('readOpsClientImplementation()') && !next.includes(helperMarker)) {
    throw new Error(`Internal rewrite error: ${name} has no helper reference.`)
  }

  fs.writeFileSync(filePath, next)
  changed += 1
  console.log(`Updated split-client source assertions: tests/${name}`)
}

console.log(`Split-client source assertion migration complete (${changed} file(s) changed).`)
