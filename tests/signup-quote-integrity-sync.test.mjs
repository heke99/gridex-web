import assert from 'node:assert/strict'
import fs from 'node:fs'

const canonical = fs.readFileSync('lib/website/canonicalQuoteValidation.ts', 'utf8')
const form = fs.readFileSync('components/signup/CustomerApplicationForm.tsx', 'utf8')
const signupPage = fs.readFileSync('app/(public)/teckna-avtal/page.tsx', 'utf8')

assert.match(canonical, /offer_reference: effectiveQuote\.contract\.offer_reference/)
assert.match(canonical, /customer_type: effectiveQuote\.customer_type/)
assert.match(canonical, /resolution_id: effectiveQuote\.resolution_id/)
assert.match(canonical, /annual_consumption_kwh: effectiveQuote\.annual_consumption_kwh/)
assert.doesNotMatch(canonical, /offer_reference: input\.contract\.offer_reference[\s\S]*customer_type: input\.customerType[\s\S]*resolution_id: area\.resolution_id/)

assert.match(form, /const showSubmissionError = Boolean\([\s\S]*errorList\.length === 0/)
assert.match(form, /\{showSubmissionError \? \(/)
assert.doesNotMatch(form, /\{submissionState\.errorMessage \? \(/)

assert.match(signupPage, /Prisunderlaget kunde inte verifieras\. Gå tillbaka till prissteget och försök igen\./)

console.log('signup quote-integrity synchronization regression: ok')
