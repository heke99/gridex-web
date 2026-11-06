import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineMobileBrand } from '../src/brand.mjs';

const makeBrand = id => ({ id, displayName: id, supportUrl: 'https://support.example.com',
  theme: { canvas: '#08090b', surface: '#0f1115', text: '#f4f6f7', muted: '#a7afb8', accent: '#35c9d7', accentText: '#041113' } });

test('two independent brands cannot mutate each other through shared theme input', () => {
  const source = makeBrand('supplier-one');
  const first = defineMobileBrand(source);
  const second = defineMobileBrand({ ...source, id: 'supplier-two' });
  source.theme.accent = '#ffffff';
  assert.equal(first.theme.accent, '#35c9d7');
  assert.equal(second.theme.accent, '#35c9d7');
  assert.throws(() => { first.theme.accent = '#000000'; }, TypeError);
  assert.notEqual(first.id, second.id);
});

test('presentation configuration rejects privileged extra fields', () => {
  for (const key of ['opsApiKey', 'serviceRoleKey', 'tenantId', 'customerId']) {
    assert.throws(() => defineMobileBrand({ ...makeBrand('supplier'), [key]: 'not-allowed' }), TypeError);
  }
});

test('brand rejects unsafe links, malformed tokens and identifiers', () => {
  for (const supportUrl of ['http://example.com', 'javascript:alert(1)', 'https://user:password@example.com']) {
    assert.throws(() => defineMobileBrand({ ...makeBrand('supplier'), supportUrl }), TypeError);
  }
  assert.throws(() => defineMobileBrand({ ...makeBrand('../invalid') }), TypeError);
  assert.throws(() => defineMobileBrand({ ...makeBrand('supplier'), theme: {} }), TypeError);
});
