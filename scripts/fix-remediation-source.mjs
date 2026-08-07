import fs from 'node:fs'
import path from 'node:path'

const filePath = path.resolve('lib/website/publicContractContract.ts')
const source = fs.readFileSync(filePath, 'utf8')
const before = `    modules.flatMap((item) => {
      const module = record(item)
      const id = module ? text(module.id) : null
      return id && module ? [[id, module] as const] : []
    }),`
const after = `    modules.flatMap((item) => {
      const legalDocument = record(item)
      const id = legalDocument ? text(legalDocument.id) : null
      return id && legalDocument ? [[id, legalDocument] as const] : []
    }),`

if (source.includes(after)) {
  console.log('Known Next.js lint blocker already remediated.')
  process.exit(0)
}

if (!source.includes(before)) {
  throw new Error('Expected legal-module lint pattern was not found; refusing a blind rewrite.')
}

fs.writeFileSync(filePath, source.replace(before, after))
console.log('Renamed the reserved local module binding without changing behavior.')
