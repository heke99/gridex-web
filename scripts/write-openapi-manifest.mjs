import { readFile, writeFile } from 'node:fs/promises'
import { sha, SPECS } from './openapi-common.mjs'

let contractVersion = null
let runtimeVersion = null
const specifications = {}
for (const [specName] of SPECS) {
  const source = await readFile(`docs/openapi/${specName}`, 'utf8')
  const document = JSON.parse(source)
  contractVersion ??= document.info?.version
  runtimeVersion ??= document['x-contract-schema-version']
  if (document.info?.version !== contractVersion) {
    throw new Error(`Cannot write manifest for mixed contract versions: ${contractVersion} and ${document.info?.version}`)
  }
  if (document['x-contract-schema-version'] !== runtimeVersion) throw new Error('Cannot write manifest for mixed response schema revisions')
  specifications[specName] = { sha256: sha(source) }
}

await writeFile(
  'docs/openapi/manifest.json',
  `${JSON.stringify({ contract_version: contractVersion, runtime_contract_version: runtimeVersion, specifications }, null, 2)}\n`,
)
console.log(`Wrote OpenAPI manifest (${contractVersion})`)
