import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const MAX_LINES = 2_000
const SOURCE_ROOTS = ['app', 'components', 'lib', 'scripts', 'supabase']
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.sql'])
const EXCLUDED_PREFIXES = [
  'lib/ops/generated/', // deterministic machine-generated OpenAPI types
]
const EXCLUDED_SEGMENTS = new Set(['node_modules', '.next', 'coverage'])

function walk(relativeDir) {
  const absoluteDir = path.join(ROOT, relativeDir)
  if (!fs.existsSync(absoluteDir)) return []
  const files = []
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    if (EXCLUDED_SEGMENTS.has(entry.name)) continue
    const relative = path.posix.join(relativeDir.replaceAll('\\', '/'), entry.name)
    if (entry.isDirectory()) files.push(...walk(relative))
    else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) files.push(relative)
  }
  return files
}

const violations = []
for (const file of SOURCE_ROOTS.flatMap(walk)) {
  if (EXCLUDED_PREFIXES.some((prefix) => file.startsWith(prefix))) continue
  const content = fs.readFileSync(path.join(ROOT, file), 'utf8')
  const lines = content.length === 0 ? 0 : content.split(/\r?\n/).length
  if (lines > MAX_LINES) violations.push({ file, lines })
}

violations.sort((a, b) => b.lines - a.lines)
if (violations.length) {
  console.error(`Production source files over ${MAX_LINES} lines:`)
  for (const { file, lines } of violations) console.error(`- ${file}: ${lines}`)
  process.exit(1)
}

console.log(`File-size guard passed: no non-generated production source file exceeds ${MAX_LINES} lines.`)
