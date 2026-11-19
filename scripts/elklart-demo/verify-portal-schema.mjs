import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

// The local Supabase platform installs pg_net; application objects must match.
const PLATFORM_EXTENSION = 'CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;'
export function comparePortalSchemas(source, restored) {
  const differences = []
  for (const key of Object.keys(source)) {
    if (['captured_at', 'database_version'].includes(key)) continue
    let expected = source[key]
    let actual = restored[key]
    if (key === 'functions') {
      expected = expected.map(f => ({ ...f, acl: [...(f.acl ?? [])].sort() }))
      actual = actual?.map(f => ({ ...f, acl: [...(f.acl ?? [])].sort() }))
    }
    if (key === 'extensions') actual = actual?.filter(value => value !== PLATFORM_EXTENSION || expected.includes(value))
    // Use stable recursive serialization because routine/view records contain arrays.
    const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value
    const serialize = value => Array.isArray(value) ? JSON.stringify(value.map(v => JSON.stringify(stable(v))).sort()) : JSON.stringify(stable(value))
    if (serialize(expected) !== serialize(actual)) differences.push(key)
  }
  return { matches: differences.length === 0, differences, source_tables: source.tables?.length, source_functions: source.functions?.length, source_views: source.views?.length, owner_statements: source.owners?.length, allowed_platform_extension: 'pg_net' }
}
async function main() {
  const [sourcePath, restoredPath] = process.argv.slice(2)
  if (!sourcePath || !restoredPath) throw new Error('Usage: node scripts/elklart-demo/verify-portal-schema.mjs source-metadata.json restored-metadata.json')
  const result = comparePortalSchemas(JSON.parse(await readFile(sourcePath, 'utf8')), JSON.parse(await readFile(restoredPath, 'utf8')))
  console.log(JSON.stringify(result))
  if (!result.matches) process.exitCode = 1
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error.message); process.exitCode = 1 })
