const VERSION_PATTERN = /^(\d{4}-\d{2}-\d{2})\.(\d+)$/

export type ContractVersionComparison = {
  localVersion: string
  receivedVersion: string | null
  headerPresent: boolean
  exactMatch: boolean
  parseable: boolean
  newerThanLocal: boolean | null
}

function numericVersion(value: string): [number, number] | null {
  const match = VERSION_PATTERN.exec(value)
  if (!match) return null
  const date = Number(match[1].replaceAll('-', ''))
  const revision = Number(match[2])
  if (!Number.isSafeInteger(date) || !Number.isSafeInteger(revision)) return null
  return [date, revision]
}

export function compareContractVersions(
  localVersion: string,
  receivedVersion: string | null,
): ContractVersionComparison {
  const local = numericVersion(localVersion)
  const received = receivedVersion ? numericVersion(receivedVersion) : null
  const parseable = Boolean(local && received)
  let newerThanLocal: boolean | null = null
  if (local && received) {
    newerThanLocal = received[0] > local[0] || (received[0] === local[0] && received[1] > local[1])
  }
  return {
    localVersion,
    receivedVersion,
    headerPresent: Boolean(receivedVersion),
    exactMatch: receivedVersion === localVersion,
    parseable,
    newerThanLocal,
  }
}

export function logContractVersionDrift(input: {
  endpoint: string
  localVersion: string
  receivedVersion: string | null
  requestId?: string | null
  correlationId?: string | null
}): ContractVersionComparison {
  const comparison = compareContractVersions(input.localVersion, input.receivedVersion)
  if (!comparison.exactMatch) {
    console.warn('[gridex-contract] runtime contract drift detected; response will be defensively parsed', {
      endpoint: input.endpoint,
      local_version: input.localVersion,
      received_version: input.receivedVersion,
      request_id: input.requestId ?? null,
      correlation_id: input.correlationId ?? null,
      header_present: comparison.headerPresent,
      parseable: comparison.parseable,
      newer_than_local: comparison.newerThanLocal,
    })
  }
  return comparison
}
