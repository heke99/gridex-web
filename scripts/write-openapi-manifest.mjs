import { readFile, writeFile } from 'node:fs/promises'
import { canonical, sha, SPECS } from './openapi-common.mjs'

let contractVersion = null
const specifications = {}
for (const [specName] of SPECS) {
  const document = JSON.parse(await readFile(`docs/openapi/${specName}`, 'utf8'))
  contractVersion ??= document.info?.version
  if (document.info?.version !== contractVersion) {
    throw new Error(`Cannot write manifest for mixed contract versions: ${contractVersion} and ${document.info?.version}`)
  }
  specifications[specName] = { sha256: sha(canonical(document)) }
}

await writeFile(
  'docs/openapi/manifest.json',
  `${JSON.stringify({ contract_version: contractVersion, specifications }, null, 2)}\n`,
)
console.log(`Wrote OpenAPI manifest (${contractVersion})`)
