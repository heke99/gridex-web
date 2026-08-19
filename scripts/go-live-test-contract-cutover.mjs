import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

async function files(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await files(p))
    else if (/\.(mjs|ts|tsx|js)$/.test(entry.name)) out.push(p)
  }
  return out
}

const replacements = [
  ["rpc('apply_ops_domain_event'", "rpc('apply_ops_domain_event_v2'"],
  ['webhook_tenant_mismatch', 'webhook_organization_mismatch'],
  ['complete_tenant_website_ready', 'complete_integration_ready'],
  ['missing_website_checkout_scopes', 'missing_website_scopes'],
  ['recommended_missing_scopes', 'missing_recommended_scopes'],
]

let changed = 0
for (const p of await files('tests')) {
  const src = await readFile(p, 'utf8')
  let next = src
  for (const [from, to] of replacements) next = next.replaceAll(from, to)
  if (next !== src) {
    await writeFile(p, next)
    console.log(`updated ${p}`)
    changed++
  }
}
console.log(`updated ${changed} test files`)
