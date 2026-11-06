import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContractsHandler } from '../lib/mobile/contractsHandler.ts';
const token = 'valid-token-123456789';
const req = (suffix = '', authorization = `Bearer ${token}`) => new Request(`https://tenant.test/api/mobile/customer/contracts${suffix}`, { headers: { authorization } });

test('disabled route never authenticates or calls OPS', async () => {
  const handler = createContractsHandler({ enabled: () => false, authenticate: () => { throw Error('unexpected'); } });
  assert.equal((await handler(req())).status, 404);
});
test('unverified or missing token never reaches customer data', async () => {
  let reads = 0;
  const handler = createContractsHandler({ enabled: () => true, authenticate: async () => null, contracts: async () => { reads++; return []; } });
  assert.equal((await handler(req('', ''))).status, 401);
  assert.equal((await handler(req())).status, 401);
  assert.equal(reads, 0);
});
test('customer overrides are rejected before identity lookup', async () => {
  const handler = createContractsHandler({ enabled: () => true, authenticate: () => { throw Error('unexpected'); } });
  assert.equal((await handler(req('?customerId=another-customer'))).status, 400);
});
test('only verified subject is forwarded and responses cannot be cached', async () => {
  const handler = createContractsHandler({ enabled: () => true, authenticate: async value => { assert.equal(value, token); return 'verified-subject'; },
    contracts: async (subject, value) => { assert.equal(subject, 'verified-subject'); assert.equal(value, token); return [{ reference: 'contract-one', name: null, status: null, startDate: null }]; } });
  const response = await handler(req());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal((await response.json()).data.contracts[0].reference, 'contract-one');
});
test('upstream errors never reveal tokens or customer details', async () => {
  const handler = createContractsHandler({ enabled: () => true, authenticate: async () => 'verified', contracts: async () => { throw Error(token); } });
  const response = await handler(req());
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes(token));
});

test('the same handler never reuses one customer response for another session', async () => {
  const handler = createContractsHandler({ enabled: () => true,
    authenticate: async value => value === token ? 'customer-one' : 'customer-two',
    contracts: async subject => [{ reference: `contract-for-${subject}`, name: null, status: null, startDate: null }],
  });
  const first = await (await handler(req())).json();
  const second = await (await handler(req('', 'Bearer another-valid-token-123456'))).json();
  assert.equal(first.data.contracts[0].reference, 'contract-for-customer-one');
  assert.equal(second.data.contracts[0].reference, 'contract-for-customer-two');
});
