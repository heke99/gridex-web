import { readdir, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'

const directory = path.join('supabase', 'migrations')
const manifestPath = path.join(directory, 'manifest.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
if (manifest.schema_version !== 1 || !Array.isArray(manifest.migrations)) throw new Error('Invalid migration manifest.')
const files = (await readdir(directory)).filter((name) => /^\d{8,14}_.+\.sql$/.test(name)).sort()
const byFile = new Map(manifest.migrations.map((row) => [row.file, row]))
const versions = new Map()
const errors = []
for (const file of files) {
  const version = file.split('_', 1)[0]
  const group = versions.get(version) ?? []
  group.push(file)
  versions.set(version, group)
  const row = byFile.get(file)
  if (!row) { errors.push(`Migration missing from manifest: ${file}`); continue }
  const body = await readFile(path.join(directory, file))
  const hash = createHash('sha256').update(body).digest('hex')
  if (row.sha256 !== hash) errors.push(`Checksum mismatch: ${file}`)
  if (row.version !== version) errors.push(`Version mismatch: ${file}`)
}
for (const [version, group] of versions) if (group.length > 1) errors.push(`Timestamp collision ${version}: ${group.join(', ')}`)
for (const row of manifest.migrations) if (!files.includes(row.file)) errors.push(`Manifest contains missing migration: ${row.file}`)
if (manifest.migration_count !== files.length) errors.push(`Manifest migration_count=${manifest.migration_count} but found ${files.length}`)
if (errors.length) throw new Error(`Migration integrity failed (${errors.length}):\n- ${errors.join('\n- ')}`)
console.log(`Migration integrity passed (${files.length} files).`)
