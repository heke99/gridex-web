import assert from 'node:assert/strict'
import { shouldObserveOpsContractVersion } from '../lib/ops/transport.ts'

assert.equal(shouldObserveOpsContractVersion('/api/v1/website/public-contracts'), true)
assert.equal(shouldObserveOpsContractVersion('/api/v1/website/quote'), true)
assert.equal(shouldObserveOpsContractVersion('/api/v1/website/customer-applications'), true)
assert.equal(shouldObserveOpsContractVersion('/api/v1/website/energy-area/resolve?postal_code=21120'), true)
assert.equal(shouldObserveOpsContractVersion('/api/v1/customer/me'), true)
assert.equal(shouldObserveOpsContractVersion('/api/v1/openapi/website-integration-v1.json'), true)
assert.equal(shouldObserveOpsContractVersion('/api/v1/internal/health'), false)
assert.equal(shouldObserveOpsContractVersion('/health'), false)

console.log('OPS contract-version observation coverage: OK')
