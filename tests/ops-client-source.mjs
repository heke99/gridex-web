import { readFileSync } from 'node:fs'

const OPS_CLIENT_SOURCE_FILES = [
  'lib/ops/client.ts',
  'lib/ops/client/types.ts',
  'lib/ops/client/core.ts',
  'lib/ops/client/website.ts',
  'lib/ops/client/application.ts',
  'lib/ops/client/portal.ts',
]

export function readOpsClientImplementation() {
  return OPS_CLIENT_SOURCE_FILES
    .map((path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'))
    .join('\n')
}
