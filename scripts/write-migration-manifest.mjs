import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'

const directory = path.join('supabase', 'migrations')
const manifestPath = path.join(directory, 'manifest.json')
const files = (await readdir(directory)).filter((name) => /^\d{8,14}_.+\.sql$/.test(name)).sort()
const versions = new Map()
const migrations = []
for (const file of files) {
  const version = file.split('_', 1)[0]
  const group = versions.get(version) ?? []
  group.push(file)
  versions.set(version, group)
  const body = await readFile(path.join(directory, file))
  migrations.push({ file, version, sha256: createHash('sha256').update(body).digest('hex') })
}
const collisions = [...versions.entries()]
  .filter(([, names]) => names.length > 1)
  .map(([version, names]) => ({ version, files: names }))
const manifest = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  migration_count: migrations.length,
  version_collisions: collisions,
  migrations,
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Wrote ${manifestPath} with ${migrations.length} migrations and ${collisions.length} version collision(s).`)
