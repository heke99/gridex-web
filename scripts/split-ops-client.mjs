import fs from 'node:fs'
import path from 'node:path'

const sourcePath = path.resolve('lib/ops/client.ts')
const outputDir = path.resolve('lib/ops/client')
const source = fs.readFileSync(sourcePath, 'utf8')
const lines = source.split(/\r?\n/)

if (lines.length <= 2_000) {
  console.log(`OPS client already split (${lines.length} lines).`)
  process.exit(0)
}

const modules = [
  { name: 'types', start: 64, end: 803 },
  { name: 'core', start: 804, end: 2638 },
  { name: 'website', start: 2639, end: 3914 },
  { name: 'application', start: 3915, end: 4589 },
  { name: 'portal', start: 4590, end: lines.length },
]

const header = lines
  .slice(0, 63)
  .filter((line) => !line.startsWith('//lib/ops/client.ts'))
  .filter((line) => !/^export \{ OpsError, isOpsError \}/.test(line))
  .join('\n')
  .trim()

function exportTopLevel(text) {
  return text
    .replace(/^(?!export\s)(type\s+[A-Za-z_$][\w$]*)/gm, 'export $1')
    .replace(/^(?!export\s)(interface\s+[A-Za-z_$][\w$]*)/gm, 'export $1')
    .replace(/^(?!export\s)(async\s+function\s+[A-Za-z_$][\w$]*)/gm, 'export $1')
    .replace(/^(?!export\s)(function\s+[A-Za-z_$][\w$]*)/gm, 'export $1')
    .replace(/^(?!export\s)(const\s+[A-Za-z_$][\w$]*)/gm, 'export $1')
    .replace(/^(?!export\s)(let\s+[A-Za-z_$][\w$]*)/gm, 'export $1')
    .replace(/^(?!export\s)(class\s+[A-Za-z_$][\w$]*)/gm, 'export $1')
}

function declaredNames(text) {
  const names = new Set()
  const patterns = [
    /^(?:export\s+)?type\s+([A-Za-z_$][\w$]*)/gm,
    /^(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/gm,
    /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm,
    /^(?:export\s+)?(?:const|let|class)\s+([A-Za-z_$][\w$]*)/gm,
  ]
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) names.add(match[1])
  }
  return [...names]
}

const prepared = modules.map((module) => {
  const raw = lines.slice(module.start - 1, module.end).join('\n').trim()
  const body = exportTopLevel(raw)
  return { ...module, body, declarations: declaredNames(body) }
})

function escapesRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

for (const target of prepared) {
  const imports = []
  for (const sourceModule of prepared) {
    if (sourceModule.name === target.name) continue
    const used = sourceModule.declarations.filter((name) =>
      new RegExp(`\\b${escapesRegExp(name)}\\b`).test(target.body),
    )
    if (used.length) imports.push(`import { ${used.join(', ')} } from './${sourceModule.name}'`)
  }

  const content = [
    header,
    imports.join('\n'),
    target.body,
    '',
  ].filter(Boolean).join('\n\n')

  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(path.join(outputDir, `${target.name}.ts`), content)
}

const facade = [
  "export { OpsError, isOpsError } from '@/lib/ops/errors'",
  "export * from './client/types'",
  "export * from './client/core'",
  "export * from './client/website'",
  "export * from './client/application'",
  "export * from './client/portal'",
  '',
].join('\n')

fs.writeFileSync(sourcePath, facade)
console.log('Split lib/ops/client.ts into responsibility modules.')
