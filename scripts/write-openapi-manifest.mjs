import { readFile, writeFile } from 'node:fs/promises'
import { sha, SPECS } from './openapi-common.mjs'

let contractVersion = null
const specifications = {}
for (const [specName] of SPECS) {
  const source = await readFile(`docs/openapi/${specName}`, 'utf8')
  const document = JSON.parse(source)
  contractVersion ??= document.info?.version
  if (document.info?.version !== contractVersion) {
    throw new Error(`Cannot write manifest for mixed contract versions: ${contractVersion} and ${document.info?.version}`)
  }
  specifications[specName] = { sha256: sha(source) }
}

await writeFile(
  'docs/openapi/manifest.json',
  `${JSON.stringify({ contract_version: contractVersion, specifications }, null, 2)}\n`,
)
console.log(`Wrote OpenAPI manifest (${contractVersion})`)
