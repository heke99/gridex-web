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

function declaredSymbols(text) {
  const symbols = new Map()
  const patterns = [
    { pattern: /^(?:export\s+)?type\s+([A-Za-z_$][\w$]*)/gm, typeOnly: true },
    { pattern: /^(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/gm, typeOnly: true },
    { pattern: /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm, typeOnly: false },
    { pattern: /^(?:export\s+)?(?:const|let|class)\s+([A-Za-z_$][\w$]*)/gm, typeOnly: false },
  ]
  for (const { pattern, typeOnly } of patterns) {
    for (const match of text.matchAll(pattern)) symbols.set(match[1], { name: match[1], typeOnly })
  }
  return [...symbols.values()]
}

const prepared = modules.map((module) => {
  const raw = lines.slice(module.start - 1, module.end).join('\n').trim()
  const body = exportTopLevel(raw)
  return { ...module, body, declarations: declaredSymbols(body) }
})

function escapesRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

for (const target of prepared) {
  const imports = []
  for (const sourceModule of prepared) {
    if (sourceModule.name === target.name) continue
    const used = sourceModule.declarations.filter(({ name }) =>
      new RegExp(`\\b${escapesRegExp(name)}\\b`).test(target.body),
    )
    const typeNames = used.filter((symbol) => symbol.typeOnly).map((symbol) => symbol.name)
    const valueNames = used.filter((symbol) => !symbol.typeOnly).map((symbol) => symbol.name)
    if (typeNames.length) imports.push(`import type { ${typeNames.join(', ')} } from './${sourceModule.name}'`)
    if (valueNames.length) imports.push(`import { ${valueNames.join(', ')} } from './${sourceModule.name}'`)
  }

  const content = [
    '/* eslint-disable @typescript-eslint/no-unused-vars */',
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
  "export type * from './client/types'",
  "export * from './client/core'",
  "export * from './client/website'",
  "export * from './client/application'",
  "export * from './client/portal'",
  '',
].join('\n')

fs.writeFileSync(sourcePath, facade)
console.log('Split lib/ops/client.ts into responsibility modules.')
