import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizePublicContractApiPayload, publicContractValidationIssues } from '../lib/website/publicContractContract.ts'
import { toBrowserLegalBundle } from '../lib/website/publicDtos.ts'

const moduleA = {
  id: '00000000-0000-4000-8000-000000000002',
  legal_bundle_version_id: '00000000-0000-4000-8000-000000000001',
  document_reference: 'legal_document_terms',
  module_key: 'general_consumer_terms',
  version: '2',
  title: 'Allmänna konsumentvillkor',
  published_at: '2026-08-01T00:00:00.000Z',
  content_sha256: 'a'.repeat(64),
  origin: 'canonical_bundle_document',
  url: 'https://app.gridex.se/legal/terms',
}
const moduleB = {
  ...moduleA,
  id: '00000000-0000-4000-8000-000000000003',
  document_reference: 'legal_document_price',
  module_key: 'price_terms',
  version: '1',
  title: 'Prisvillkor',
  content_sha256: 'b'.repeat(64),
  url: 'https://app.gridex.se/legal/price',
}
const contract = {
  offer_reference: 'offer_20260805_grouped_legal',
  name: 'Rörligt månadspris',
  contract_type: 'variable_monthly',
  energy_direction: 'consumption',
  customer_type: 'private',
  channel: 'website',
  price_options: [{
    price_option_reference: 'option_20260805', option_code: 'standard', customer_name: 'Standard',
    price_type: 'variable_monthly', contract_type: 'variable_monthly', customer_type: 'private',
    resolution: 'monthly', currency: 'SEK', unit: 'ore_per_kwh', fixed_price: null, markup: 4,
    monthly_fee: 49, binding_months: 0, notice_months: 1, auto_renew_enabled: false,
    renewal_term_months: null, is_default: true, default: true, selection_required: false,
    valid_from: null, valid_to: null, earliest_start_date: null, latest_start_date: null, area_prices: [],
  }],
  pricing: { visibility: {}, calculation_components: [], display_components: [], summary_components: [], calculation_contract: {} },
  legal: {
    legal_bundle_reference: 'legal_bundle_20260805',
    legal_bundle_version_id: '00000000-0000-4000-8000-000000000001',
    power_of_attorney_version_id: null, immutable: true,
    required_modules: ['general_consumer_terms', 'price_terms'],
    module_versions: [moduleA, moduleB],
    customer_documents: [{
      requirement_code: 'agreement', document_type: 'agreement',
      title: 'Elhandelsavtal och fullständiga villkor',
      description: 'Kundens sammanhållna avtal.', required: true, acceptance_mode: 'accept',
      document_reference: 'legal_customer_document_grouped',
      document_version: 'legal_customer_version_grouped', document_hash: 'c'.repeat(64),
      document_url: null, legal_bundle_version_id: '00000000-0000-4000-8000-000000000001',
      module_keys: ['general_consumer_terms', 'price_terms'],
      source_document_ids: [moduleA.id, moduleB.id], primary_document_id: null, sort_order: 10,
    }],
  },
}

const normalized = normalizePublicContractApiPayload(contract)
assert.ok(normalized)
assert.equal(normalized.legal.customer_documents.length, 1)
assert.equal(normalized.legal_requirements.length, 1)
assert.equal(normalized.legal.customer_documents[0].requirement_code, 'agreement')
assert.equal(normalized.legal.customer_documents[0].public_url, null)
assert.deepEqual(normalized.legal.customer_documents[0].source_document_ids, [moduleA.id, moduleB.id])
assert.equal(publicContractValidationIssues(contract).filter((issue) => issue.severity === 'blocking').length, 0)

const sourceMismatch = structuredClone(contract)
sourceMismatch.legal.customer_documents[0].source_document_ids = [moduleA.id]
assert.ok(
  publicContractValidationIssues(sourceMismatch).some(
    (issue) => issue.code === 'legal_customer_document_module_source_missing',
  ),
)

const browserLegalBundle = toBrowserLegalBundle({
  offer_reference: contract.offer_reference,
  bundle_version: contract.legal.legal_bundle_version_id,
  required_types: ['general_consumer_terms', 'price_terms'],
  present_types: ['general_consumer_terms', 'price_terms'],
  complete: true,
  missing_types: [],
  requirements: [{
    requirement_code: 'agreement',
    document_type: 'agreement',
    title: contract.legal.customer_documents[0].title,
    description: contract.legal.customer_documents[0].description,
    required: true,
    acceptance_mode: 'accept',
    document_reference: contract.legal.customer_documents[0].document_reference,
    document_version: contract.legal.customer_documents[0].document_version,
    document_hash: contract.legal.customer_documents[0].document_hash,
    document_url: 'https://app.gridex.se/legal/customer/agreement',
    legal_bundle_version_id: contract.legal.legal_bundle_version_id,
    module_keys: ['general_consumer_terms', 'price_terms'],
    source_document_ids: [moduleA.id, moduleB.id],
    primary_document_id: null,
    sort_order: 10,
  }],
  texts: [],
  raw: {},
})
assert.equal(browserLegalBundle.supported_by_application_contract, true)
assert.equal(browserLegalBundle.requirements.length, 1)

const form = readFileSync(new URL('../components/signup/CustomerApplicationForm.tsx', import.meta.url), 'utf8')
const signup = readFileSync(new URL('../app/(public)/teckna-avtal/page.tsx', import.meta.url), 'utf8')
assert.ok(form.includes('selectedContract.legal.customer_documents'))
assert.ok(signup.includes('offer.legal.customer_documents'))
assert.ok(!form.includes('requirement.public_url &&\n        requirement.document_reference'))
assert.ok(!signup.includes('requirement.document_hash &&\n        requirement.public_url'))
assert.ok(signup.includes('groupedPowerOfAttorneyDocumentId'))

console.log('Gridex API 2026-08-05.1 grouped legal-document regression checks passed')
