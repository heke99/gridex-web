import assert from 'node:assert/strict'
import fs from 'node:fs'

const canonical = fs.readFileSync('lib/website/canonicalQuoteValidation.ts', 'utf8')
const form = fs.readFileSync('components/signup/CustomerApplicationForm.tsx', 'utf8')
const signupPage = fs.readFileSync('app/(public)/teckna-avtal/page.tsx', 'utf8')
const quoteRoute = fs.readFileSync('app/api/checkout/quote/route.ts', 'utf8')
const quoteFastPath = fs.readFileSync('lib/ops/client/quoteFastPath.ts', 'utf8')

assert.match(canonical, /offer_reference: effectiveQuote\.contract\.offer_reference/)
assert.match(canonical, /customer_type: effectiveQuote\.customer_type/)
assert.match(canonical, /resolution_id: effectiveQuote\.resolution_id/)
assert.match(canonical, /annual_consumption_kwh: effectiveQuote\.annual_consumption_kwh/)
assert.doesNotMatch(canonical, /offer_reference: input\.contract\.offer_reference[\s\S]*customer_type: input\.customerType[\s\S]*resolution_id: area\.resolution_id/)

assert.match(form, /const showSubmissionError = Boolean\([\s\S]*errorList\.length === 0/)
assert.match(form, /\{showSubmissionError \? \(/)
assert.doesNotMatch(form, /\{submissionState\.errorMessage \? \(/)

assert.match(signupPage, /Prisunderlaget kunde inte verifieras\. Gå tillbaka till prissteget och försök igen\./)

// Contract-feed verification and the authoritative OPS quote are independent
// network operations. Keep them parallel, then independently cross-check the
// OPS-selected default before a customer checkout token can be issued.
assert.match(
  quoteRoute,
  /const \[contractsSnapshot, opsQuote\] = await Promise\.all\(\[[\s\S]*fetchOpsPublicContractsSnapshot\(customerType\)[\s\S]*fetchOpsWebsiteQuoteAutoSelect\(/,
)
assert.match(
  quoteRoute,
  /opsQuote\.price_option_reference !== selectedPriceOptionReference/,
)
assert.match(
  quoteRoute,
  /opsQuote\.area_price_reference !== selectedAreaPriceReference/,
)
assert.match(
  quoteFastPath,
  /\.\.\.\(input\.price_option_reference[\s\S]*\? \{ price_option_reference: input\.price_option_reference \}[\s\S]*: \{\}\)/,
)
assert.match(
  quoteFastPath,
  /selectedPriceOptionReference = normalizeText\([\s\S]*extractQuoteRow\(payload\)\.price_option_reference/,
)
assert.match(
  quoteFastPath,
  /mapOpsWebsiteQuote\(payload, \{[\s\S]*price_option_reference: selectedPriceOptionReference/,
)

console.log('signup quote-integrity synchronization regression: ok')
