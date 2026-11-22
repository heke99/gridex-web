import assert from 'node:assert/strict'
import {GRIDEX_API_CONTRACT_VERSION as WIRE} from '../lib/ops/contract.ts'
import {generateKeyPairSync,verify} from 'node:crypto'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {opsRequest} from '../lib/ops/transport.ts'
import {signCustomerAssertion} from '../lib/ops/customerAssertion.ts'
import {mapOpsWebsiteQuote} from '../lib/ops/client/core.ts'
import {mapOpsCustomerApplicationResult,assertAcceptedApplication} from '../lib/ops/client/application.ts'
import {fetchOpsCustomerPortalBundle, fetchOpsCustomerResource, markOpsCustomerNotificationsRead} from '../lib/ops/client/portal.ts'
import {assertWebsiteResponse} from '../lib/ops/validators/openapi.ts'
import {parseRequestedStartSelection} from '../lib/website/requestedStart.ts'
import {stockholmDayBounds} from '../lib/website/businessDate.ts'
import {fetchDailySpotAverageFromElprisetJustNu,fetchMonthlySpotAverageFromElprisetJustNu} from '../lib/gridex/pricing/elprisetjustnu.ts'
import {getLivePriceSummary} from '../lib/gridex/livePrices.ts'
import {issueWebsitePricingQuote,verifyWebsitePricingQuote,validateWebsitePricingQuote} from '../lib/website/pricingQuote.ts'
import PriceResultCard from '../components/PriceResultCard.tsx'
import {buildPublicContractDisplay} from '../lib/website/publicContractDisplay.ts'
import {createWebsiteApplicationResult,readWebsiteApplicationResultState} from '../lib/website/applicationResultStore.ts'
const swedishMidnight = new Date('2026-11-29T23:00:00Z')
assert.deepEqual(parseRequestedStartSelection({ mode: 'specific_date', requestedDate: '2026-11-29', now: swedishMidnight }), {
 ok: false, code: 'requested_start_date_past',
})
assert.equal(parseRequestedStartSelection({ mode: 'specific_date', requestedDate: '2026-11-29', now: new Date(swedishMidnight.getTime() - 1) }).ok, true)
assert.equal(parseRequestedStartSelection({ mode: 'specific_date', requestedDate: '2026-11-30', now: swedishMidnight }).ok, true)
process.env.GRIDEX_API_KEY='gridex_live_offline_audit_regression_key'
process.env.GRIDEX_OPS_API_URL='https://app.gridex.se/api/v1'
process.env.GRIDEX_OPS_TIMEOUT_MS='1000'
process.env.VERCEL_ENV='production'
const originalFetch=globalThis.fetch
let calls=0
try {
 globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({error:{code:'permanent',message:'permanent',retryable:false}}),{status:503,headers:{'Content-Type':'application/json'}})}
 await assert.rejects(()=>opsRequest('/api/v1/customer/me'),e=>e.status===503&&!e.retryable)
 assert.equal(calls,1)
 let stalledBodyCancelled=false
 globalThis.fetch=async()=>new Response(new ReadableStream({cancel(){stalledBodyCancelled=true}}),{headers:{'content-type':'application/json'}})
 const before=Date.now()
 await assert.rejects(()=>opsRequest('/api/v1/customer/me'),e=>e.status===504&&e.code==='ops_request_timeout')
 assert.ok(Date.now()-before<1800,'body read must remain inside the configured deadline')
 assert.equal(stalledBodyCancelled,true,'the timed-out upstream body must be cancelled')
 const controller=new AbortController();controller.abort(new Error('caller cancelled'))
 await assert.rejects(()=>opsRequest('/api/v1/customer/me',{signal:controller.signal}),/caller cancelled/)
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048})
 Object.assign(process.env,{GRIDEX_CUSTOMER_ASSERTION_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),GRIDEX_CUSTOMER_ASSERTION_KEY_ID:'offline-test',GRIDEX_CUSTOMER_ASSERTION_ISSUER:'gridex-tenant:offline',GRIDEX_CUSTOMER_ASSERTION_AUDIENCE:'gridex-customer-api:offline'})
 const uid='11111111-1111-4111-8111-111111111111'
 const first=signCustomerAssertion(uid), second=signCustomerAssertion(uid)
 const [h,p,signature]=first.split('.')
 assert.ok(verify('RSA-SHA256',Buffer.from(h+'.'+p),publicKey,Buffer.from(signature,'base64url')))
 const claims=JSON.parse(Buffer.from(p,'base64url'))
 assert.equal(claims.sub,uid);assert.equal(claims.exp-claims.iat,60);assert.notEqual(claims.jti,JSON.parse(Buffer.from(second.split('.')[1],'base64url')).jti)
 for(const k of ['GRIDEX_CUSTOMER_ASSERTION_PRIVATE_KEY','GRIDEX_CUSTOMER_ASSERTION_KEY_ID','GRIDEX_CUSTOMER_ASSERTION_ISSUER','GRIDEX_CUSTOMER_ASSERTION_AUDIENCE'])delete process.env[k]
 globalThis.fetch=async(_url,init)=>{
  const body=JSON.parse(init.body);assert.deepEqual(body,{notification_references:['notification_abcdefghijklmnopqrstuvwx']})
  return new Response(JSON.stringify({data:{updated_count:1,notification_references:body.notification_references,read_at:'2026-10-06T12:00:00Z'},request_id:'offline',contract_schema_version:WIRE}),{headers:{'Content-Type':'application/json'}})
 }
 await markOpsCustomerNotificationsRead({userId:uid,externalCustomerId:'customer_offline'}, {notificationIds:['notification_abcdefghijklmnopqrstuvwx'],operationId:'offline-operation'})
 const startDates = { requested_start_date: '2026-12-05', confirmed_start_date: '2026-12-14', actual_start_date: null }
 let contractDates = startDates
 globalThis.fetch = async (_url, init) => {
  assert.equal(new Headers(init.headers).get('Prefer'), 'contract-start-dates')
  return Response.json({
   data: [{ contract_reference: 'contract_abcdefghijklmnopqrstuvwx', status: 'active', start_date: '2026-12-14', ...contractDates }],
   page: { returned: 1, has_more: false, next_cursor: null },
   request_id: 'offline-contracts', contract_schema_version: WIRE,
  }, { headers: contractDates ? { 'Preference-Applied': 'contract-start-dates' } : {} })
 }
 const identity = { userId: uid, externalCustomerId: 'customer_offline' }
 const modernContract = (await fetchOpsCustomerResource(identity, 'contracts')).data[0]
 assert.equal(modernContract.requested_start_date, startDates.requested_start_date)
 assert.equal(modernContract.confirmed_start_date, startDates.confirmed_start_date)
 contractDates = { ...startDates, confirmed_start_date: '2026-02-30' }
 await assert.rejects(() => fetchOpsCustomerResource(identity, 'contracts'), { code: 'ops_contract_start_date_invalid' })
 contractDates = null
 const legacyContract = (await fetchOpsCustomerResource(identity, 'contracts')).data[0]
 assert.equal(legacyContract.start_date, '2026-12-14')
 assert.equal(Object.hasOwn(legacyContract, 'confirmed_start_date'), false)
 globalThis.fetch = async (url, init) => {
  const request = new URL(url)
  assert.equal(request.pathname, '/api/v1/customer/portal-bundle')
  assert.deepEqual([...request.searchParams], [['include', 'events'], ['events_limit', '8']])
  assert.equal(init.method, 'POST')
  assert.equal(new Headers(init.headers).get('x-gridex-auth-user-id'), uid)
  return Response.json({ data: {
   profile: { display_name: 'Synthetic customer' },
   contracts: [{ contract_reference: 'contract_abcdefghijklmnopqrstuvwx', status: 'active', ...startDates }],
   events: [{ event_reference: 'event_fixture' }],
  }, request_id: 'offline-contract-bundle', contract_schema_version: WIRE },
  { headers: { 'Preference-Applied': 'contract-start-dates' } })
 }
 const contractBundleProjection = await fetchOpsCustomerPortalBundle(identity, 'contracts')
 assert.equal(contractBundleProjection.contracts[0].confirmed_start_date, startDates.confirmed_start_date)
 assert.equal(contractBundleProjection.events.length, 1)
 assert.equal(contractBundleProjection.meteringValues.length, 0)
 let feeValue = 7
 globalThis.fetch = async (_url, init) => {
  const headers = new Headers(init.headers)
  assert.equal(headers.get('X-Gridex-Contract-Pricing'), 'separate-variable-fee')
  assert.equal(headers.get('Prefer'), 'contract-start-dates')
  return Response.json({
   data: [{ contract_reference: 'contract_abcdefghijklmnopqrstuvwx', status: 'active',
    markup_ore_per_kwh: null, variable_fee_ore_per_kwh: feeValue }],
   page: { returned: 1, has_more: false, next_cursor: null },
   request_id: 'offline-contract-prices', contract_schema_version: WIRE,
  }, { headers: { 'X-Gridex-Contract-Pricing': 'separate-variable-fee' } })
 }
 const feeOnly = (await fetchOpsCustomerResource(identity, 'contracts')).data[0]
 assert.equal(feeOnly.variable_fee_ore_per_kwh, 7)
 assert.equal(feeOnly.markup_ore_per_kwh, null)
 feeValue = 'invalid'
 await assert.rejects(() => fetchOpsCustomerResource(identity, 'contracts'), { code: 'ops_contract_variable_fee_invalid' })
 globalThis.fetch = async url => {
  assert.equal(new URL(url).searchParams.get('cursor'), 'opaque+/=')
  return Response.json({ data: [{ invoice_reference: 'invoice_abcdefghijklmnopqrstuvwx', status: 'issued' }],
   page: { limit: 25, offset: 0, returned: 1, has_more: false, next_cursor: null }, request_id: 'offline-invoices', contract_schema_version: WIRE })
 }
 const paginatedInvoices = await fetchOpsCustomerResource(identity, 'invoices', undefined, 'opaque+/=')
 assert.equal(paginatedInvoices.page.has_more, false)
 console.log('Transport, notification contract and signed customer assertion regressions passed')
const input = { resolution_id: 'resolution_audit_price', offer_reference: 'offer_audit_price',
  annual_consumption_kwh: 1200, start_date: '2026-10-06', price_option_reference: 'option_audit_price',
  invoice_delivery_method: 'e_invoice', selected_component_references: [], site_count: 1,
  requested_start_mode: 'specific_date', customer_type: 'private' }
const payload = { request_id: 'offline-pricing-audit', contract_schema_version: WIRE, data: {
  quote_reference: 'quote_audit_price', offer_reference: input.offer_reference, valid_until: '2030-01-01T00:00:00Z',
  input: { ...input, price_area: 'SE3', estimated_monthly_consumption_kwh: 100 },
  offer: { name: 'Syntetiskt fastpris', contract_type: 'fixed' }, energy_direction: 'consumption', production_pricing: null,
  price_option_reference: input.price_option_reference, area_price_reference: 'area_price_audit',
  invoice_delivery_method: input.invoice_delivery_method, selected_component_references: [],
  mandatory_component_references: ['component_monthly_audit'], conditional_component_references: [], site_count: 1,
  pricing: { price_per_kwh_ore: 100 },
  selected_area_price: { price_area: 'SE3', energy_price_ore_per_kwh: 100, unit: 'ore_per_kwh' },
  estimate: { monthly_ex_vat: 149, monthly_vat: 37.25, monthly_inc_vat: 186.25,
    annual_ex_vat: 1788, annual_vat: 447, annual_inc_vat: 2235 },
  lines: [{ component_code: 'monthly_fee', name: 'Månadsavgift', quantity: 1, unit: 'sek_per_month',
    unit_price_ex_vat: 49, amount_ex_vat: 49, vat_rate: 0.25, vat_amount: 12.25, amount_inc_vat: 61.25 }],
  resolved_price_components: [{ component_code: 'monthly_fee', name: 'Månadsavgift', amount: 49,
    unit: 'sek_per_month', calculation_inclusion: 'included', website_visibility: 'visible' }],
  settlement: { model: 'fixed_price', customer_accepts: 'fixed_energy_price', energy_price_locked_at_signup: true,
    uses_actual_metered_consumption: true, market_data_role: 'not_applicable', settlement_resolution: 'fixed' },
  is_binding: true, pricing_interval: 'monthly', estimate_method: 'canonical_monthly_preview',
  pricing_snapshot_schema_version: '2026-10-04.1', assumptions: [], market_sources: [],
} }
assertWebsiteResponse('WebsiteQuoteResponse', payload, '/api/v1/website/quote')
 const preview=mapOpsWebsiteQuote(payload,input)
 assert.equal(preview.specification.fees.monthlyFeeSek,49);assert.equal(preview.totalYearlyCostSek,2235)
 assert.match(renderToStaticMarkup(createElement(PriceResultCard,{data:preview})),/Månadsavgift/)
 assert.equal(preview.specification.canonicalLines.length,1)
 assert.match(renderToStaticMarkup(createElement(PriceResultCard,{data:preview})),/61,25/)
 const hidden=structuredClone(payload);hidden.data.resolved_price_components[0].website_visibility='hidden'
 assert.equal(mapOpsWebsiteQuote(hidden,input).specification.fees.monthlyFeeSek,undefined,'hidden fees must remain calculation-only')
 const component={component_code:'monthly_fee',name:'Månadsavgift',amount:49,unit:'sek_per_month',calculation_inclusion:'included',website_visibility:'visible',vat_included:false,vat_rate:0.25}
 const display=buildPublicContractDisplay({type:'variable_monthly',name:'Test',offer_reference:input.offer_reference,energy_direction:'consumption',display_components:[component],pricing_components:[component],legal_requirements:[]})
 assert.match(display.rows.find(r=>r.key==='monthly_fee').formatted,/exkl. moms/)
 const production={...preview,energy_direction:'production'}
 const productionHtml=renderToStaticMarkup(createElement(PriceResultCard,{data:production}))
 assert.match(productionHtml,/Beräknad månadsersättning/);assert.match(productionHtml,/Teckna produktionsavtal/)
 const secret='offline-old-quote-signing-secret-at-least-32-bytes'
 process.env.GRIDEX_WEBSITE_STATE_SIGNING_SECRET=secret;process.env.GRIDEX_WEBSITE_STATE_SIGNING_KID='old'
 const contract={offer_reference:input.offer_reference,name:'Test',type:'fixed',energy_direction:'consumption'}
 const location={postalCode:'11122',city:'Teststad',address:'Testgatan 1'}
 const issued=issueWebsitePricingQuote({preview,contract,customerType:'private',requestedStartMode:'specific_date',quoteAttemptId:uid,location})
 assert.ok(issued)
 process.env.GRIDEX_WEBSITE_STATE_SIGNING_PREVIOUS_SECRET=secret;process.env.GRIDEX_WEBSITE_STATE_SIGNING_PREVIOUS_KID='old'
 process.env.GRIDEX_WEBSITE_STATE_SIGNING_SECRET='offline-new-quote-signing-secret-at-least-32-bytes';process.env.GRIDEX_WEBSITE_STATE_SIGNING_KID='new'
 assert.ok(verifyWebsitePricingQuote(issued.token,new Date('2035-01-01')).ok)
 assert.ok(validateWebsitePricingQuote({token:issued.token,contract,customerType:'private',priceAreaCode:'SE3',estimatedMonthlyKwh:100,annualConsumptionKwh:1200,location}).ok)
 assert.equal(validateWebsitePricingQuote({token:issued.token,contract,customerType:'private',priceAreaCode:'SE3',estimatedMonthlyKwh:100,annualConsumptionKwh:1200,location:{...location,address:'Annat 2'}}).ok,false)
 const day='2026-10-06', bounds=stockholmDayBounds(day)
 const entries=Array.from({length:24},(_,i)=>({SEK_per_kWh:i===0?-1:1,time_start:new Date(bounds.start+i*3600000).toISOString(),time_end:new Date(bounds.start+(i+1)*3600000).toISOString()}))
 let requestedUrl
 globalThis.fetch=async url=>{requestedUrl=String(url);return {ok:true,status:200,json:async()=>entries}}
 const summary=await getLivePriceSummary({supabase:{},area:'SE3',date:day,now:new Date('2026-10-07T12:00:00Z')})
 assert.equal(summary.date,day);assert.match(requestedUrl,/2026\/10-06_SE3/);assert.equal(summary.current,null)
 await assert.rejects(()=>getLivePriceSummary({supabase:{},area:'SE3',date:'2026-02-31'}),e=>e.status===400)
 globalThis.fetch=async()=>({ok:true,status:200,json:async()=>entries.slice(0,23)})
 await assert.rejects(()=>fetchDailySpotAverageFromElprisetJustNu({year:2026,month:10,day:6,priceArea:'SE3'}),/komplett/)
 globalThis.fetch=async()=>({ok:true,status:200,json:async()=>[{...entries[0],SEK_per_kWh:null},...entries.slice(1)]})
 await assert.rejects(()=>fetchDailySpotAverageFromElprisetJustNu({year:2026,month:10,day:6,priceArea:'SE3'}),/giltiga/)
 for(const date of ['2026-03-29','2026-10-25']) {
  const b=stockholmDayBounds(date);const expected=date.includes('03')?23:25;assert.equal((b.end-b.start)/3600000,expected)
  globalThis.fetch=async()=>({ok:true,status:200,json:async()=>Array.from({length:expected},(_,i)=>({SEK_per_kWh:0,time_start:new Date(b.start+i*3600000).toISOString(),time_end:new Date(b.start+(i+1)*3600000).toISOString()}))})
  const [year,month,day]=date.split('-').map(Number)
  assert.equal((await fetchDailySpotAverageFromElprisetJustNu({year,month,day,priceArea:'SE3'})).avgSpotOre,0)
 }
 let active=0,maxActive=0,totalCalls=0
 globalThis.fetch=async url=>{
  active++;maxActive=Math.max(maxActive,active);totalCalls++
  await new Promise(r=>setTimeout(r,2));active--
  const date=String(url).match(/2026\/(\d{2})-(\d{2})_/) ;const b=stockholmDayBounds(`2026-${date[1]}-${date[2]}`)
  return {ok:true,status:200,json:async()=>Array.from({length:24},(_,i)=>({SEK_per_kWh:1,time_start:new Date(b.start+i*3600000).toISOString(),time_end:new Date(b.start+(i+1)*3600000).toISOString()}))}
 }
 await Promise.all(Array.from({length:128},()=>fetchMonthlySpotAverageFromElprisetJustNu({year:2026,month:9,priceArea:'SE3'})))
 assert.equal(totalCalls,30);assert.ok(maxActive<=4)
 console.log('Price fees, VAT metadata, production display, key rotation, non-expiring quotes, market date/DST and monthly fan-out regressions passed')
 const checkout={outcome:'application_received',thank_you_ready:false,page_state:'processing',customer_action_required:false,application:{application_number:'APP-TEST',status:'processing'},agreement:{status:null,contract_number:null,signed_at:null,withdrawal_deadline_at:null,signature_snapshot_sha256:null},confirmation_email:{expected:false,status:'not_expected'},status_path:null}
 const received=mapOpsCustomerApplicationResult({data:{status:'processing',application_number:'APP-TEST',checkout,missing_fields:[],blocking_reasons:[],warnings:[],grid_owner_verification_issues:[],supplier_switch:{status:'not_created',request_id:null,can_create_request:false,can_dispatch:false,blockers:[],next_action:'resolve_switch_blockers'}}})
 const now=new Date().toISOString()
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://audit.invalid'
 process.env.SUPABASE_SERVICE_ROLE_KEY='offline-result-service-key'
 process.env.WEBSITE_RESULT_TOKEN_SECRET='offline-result-secret-'.repeat(3)
 const receiptWrites = []
 globalThis.__auditResultDb = { from: () => ({
  upsert: async (_rows, options) => { receiptWrites.push(options); return { error: null } },
 }) }
 const receiptInput={submissionAttemptId:'22222222-2222-4222-8222-222222222222',userId:null,receivedAt:now,result:{checkout,applicationNumber:'APP-TEST',energyDirection:'consumption',signedAt:null}}
 const pendingToken=await createWebsiteApplicationResult(receiptInput)
 const pendingReceipt=await readWebsiteApplicationResultState(pendingToken)
 assert.equal(pendingReceipt.status,'verified')
 assert.equal(pendingReceipt.result.signedAt,null)
 assert.equal(receiptWrites[1].ignoreDuplicates, true)
 assert.equal(Date.parse(pendingReceipt.expiresAt),Date.parse(now)+24*60*60*1000)
 assert.equal(await createWebsiteApplicationResult(receiptInput),pendingToken,'same attempt and immutable receipt must preserve the token')
 const { default: SignupThanksPage } = await import('../app/(public)/teckna-avtal/tack/SignupThanksPage.tsx')
 const pendingPage = renderToStaticMarkup(await SignupThanksPage({ searchParams: Promise.resolve({ result: pendingToken }) }))
 assert.match(pendingPage, /<h1[^>]*>Din ansökan behandlas<\/h1>/)
 assert.match(pendingPage, /Avtalet behandlas fortfarande\./)
 assert.match(pendingPage, /Bekräftelse och leverantörsbyte vid inskickningen/)
 assert.doesNotMatch(pendingPage, /Ditt avtal är klart|Ångerfristen löper till/)
 const invalidPage = renderToStaticMarkup(await SignupThanksPage({ searchParams: Promise.resolve({ result: 'invalid' }) }))
 assert.match(invalidPage, /Teckningen kan inte verifieras från länken/)
 assert.doesNotMatch(invalidPage, /data-application-status=/)
 const { GET: readSwitchStatus } = await import('../app/api/checkout/switch-status/route.ts')
 globalThis.__auditSwitchStatus = (application, options) => {
  assert.equal(application, 'APP-TEST')
  assert.deepEqual(options, { includeEvents: false })
  return { switch: null }
 }
 try {
  const response = await readSwitchStatus(new Request(`https://gridex.se/api/checkout/switch-status?result_token=${encodeURIComponent(pendingToken)}`))
  assert.equal(response.status, 200)
  assert.match(response.headers.get('cache-control'), /private, no-store/)
  const { data } = await response.json()
  assert.equal(data.status, 'unknown')
  assert.equal(data.terminal, false)
  assert.match(data.label, /obekräftad/)
 } finally {
  delete globalThis.__auditSwitchStatus
 }
 const { GET: readApplicationStatus } = await import('../app/api/checkout/applications/[applicationId]/route.ts')
 const compactStatus = { application_number: 'APP-TEST', status: 'processing', stage: 'queued', checkout, updated_at: '2026-10-06T20:00:00.123456+00:00' }
 const saved = []
 let statusReads = 0
 let sourceUpdatedAt = compactStatus.updated_at
 globalThis.__auditApplicationStatus = (application, options) => {
  statusReads++
  assert.equal(application, 'APP-TEST')
  assert.deepEqual(options, { includeWebhookDiagnostics: false })
  const snapshot = { ...compactStatus, updated_at: sourceUpdatedAt }
  return { ...snapshot, raw: snapshot }
 }
 let storageError = null
 globalThis.__auditSubmissionDb = { rpc: async (name, args) => {
  assert.equal(name, 'gridex_sync_website_submission_status')
  saved.push(args)
  return { data: storageError ? null : true, error: storageError }
 } }
 try {
  const receiptStatusUrl = new Request(`https://gridex.se/api/checkout/applications/APP-TEST?result_token=${encodeURIComponent(pendingToken)}`)
  const response = await readApplicationStatus(receiptStatusUrl, { params: Promise.resolve({ applicationId: 'APP-TEST' }) })
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).data, compactStatus)
  assert.deepEqual(saved, [{
   p_application_number: 'APP-TEST',
   p_source_updated_at: compactStatus.updated_at,
   p_status: 'processing',
   p_workflow_state: 'queued',
   p_customer_number: null,
   p_contract_status: null,
   p_switch_status: null,
   p_snapshot: compactStatus,
  }])
  const wrongReceipt = await readApplicationStatus(receiptStatusUrl, { params: Promise.resolve({ applicationId: 'APP-OTHER' }) })
  assert.equal(wrongReceipt.status, 404)
  assert.equal(statusReads, 1)
  for (const unavailableVersion of [null, '2026-10-06T20:00:00']) {
   sourceUpdatedAt = unavailableVersion
   const unversioned = await readApplicationStatus(receiptStatusUrl, { params: Promise.resolve({ applicationId: 'APP-TEST' }) })
   assert.equal(unversioned.status, 200)
   assert.equal(saved.length, 1)
  }
  sourceUpdatedAt = '2026-10-06T20:00:00.123457+00:00'
  storageError = { message: 'Simulated write failure' }
  const auditErrors = []
  const originalConsoleError = console.error
  console.error = (...args) => auditErrors.push(args)
  try {
   const failedSync = await readApplicationStatus(receiptStatusUrl, { params: Promise.resolve({ applicationId: 'APP-TEST' }) })
   assert.equal(failedSync.status, 200)
   assert.equal((await failedSync.json()).data.updated_at, sourceUpdatedAt)
   assert.equal(saved[1].p_source_updated_at, sourceUpdatedAt)
   assert.equal(auditErrors[0][0], 'website_application_status_audit_sync_failed')
   assert.match(auditErrors[0][1].message, /Simulated write failure/)
  } finally {
   console.error = originalConsoleError
  }
 } finally {
  delete globalThis.__auditApplicationStatus
  delete globalThis.__auditSubmissionDb
 }
 await assert.rejects(()=>createWebsiteApplicationResult({...receiptInput,receivedAt:undefined}),/timestamp/)
 await assert.rejects(()=>createWebsiteApplicationResult({...receiptInput,receivedAt:'invalid'}),/timestamp/)
 delete process.env.WEBSITE_RESULT_TOKEN_SECRET
 const legacyRow = {
  public_result: receiptInput.result,
  expires_at: pendingReceipt.expiresAt,
  submission_attempt_id: receiptInput.submissionAttemptId,
  user_id: uid,
 }
 let storedLink = legacyRow
 globalThis.__auditResultDb = { from: table => {
  assert.equal(table, 'website_application_result_links')
  return {
  select(fields) {
   assert.match(fields, /submission_attempt_id,user_id/)
   return this
  },
  eq() { return this },
  maybeSingle: async () => ({ data: storedLink, error: null }),
  }
 } }
 const legacyReceipt = await readWebsiteApplicationResultState('A'.repeat(32))
 assert.equal(legacyReceipt.status, 'verified')
 assert.equal(legacyReceipt.source, 'database')
 assert.equal(legacyReceipt.submissionAttemptId, receiptInput.submissionAttemptId)
 assert.equal(legacyReceipt.userId, uid)
 storedLink = { ...legacyRow, expires_at: '2000-01-01T00:00:00Z' }
 assert.equal((await readWebsiteApplicationResultState('A'.repeat(32))).status, 'expired')
 storedLink = null
 assert.equal((await readWebsiteApplicationResultState('A'.repeat(32))).status, 'invalid')
 console.log('Unsigned processing receipt remains valid without inventing a signature; retries preserve its token')
 assert.equal(received.checkout.page_state,'processing');assert.throws(()=>assertAcceptedApplication(received))
 const deceptivelyAccepted={...received,status:'accepted',customer_number:'C-TEST',contract_status:'signed',signed_at:'2026-10-06T10:00:00Z',signature_snapshot_sha256:'a'.repeat(64),workflow_state:'canonical_data_committed',communication:{source_of_truth:'communication_logs'}}
 assert.throws(()=>assertAcceptedApplication(deceptivelyAccepted),e=>e.code==='ops_checkout_not_ready')
 const user={id:uid,email:'customer@example.invalid',email_confirmed_at:'2026-10-06T10:00:00Z'}
 globalThis.__auditRegression={resource:null,db:{auth:{getUser:async()=>({data:{user}}),verifyOtp:async()=>({data:{},error:null})},from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{user_id:uid,email:user.email,external_customer_id:'customer_offline'}})})}}
 const service=await import('../lib/customerPortal/service.ts')
 globalThis.__auditRegression.resource={sites:[{facility_reference:'facility_abcdefghijklmnopqrstuvwx',address:{street:'Testgatan 1',postal_code:'11122',city:'Teststad'},status:'active'}]}
 assert.equal((await service.getCanonicalCustomerResource('sites')).data[0].address,'Testgatan 1')
 globalThis.__auditRegression.resource={documents:[{document_reference:'document_abcdefghijklmnopqrstuvwx',secure_url:'https://example.invalid/test.pdf',version:'v1'}]}
 assert.equal((await service.getCanonicalCustomerResource('documents')).data[0].download_url,'https://example.invalid/test.pdf')
 globalThis.__auditRegression.resource={invoices:[{invoice_reference:'invoice_abcdefghijklmnopqrstuvwx',status:'draft'}]}
 assert.equal((await service.getCanonicalCustomerResource('invoices')).data[0].total_amount,null)
 globalThis.__auditRegression.resource={invoices:[{invoice_reference:'invoice_abcdefghijklmnopqrstuvwx',status:'paid',amount_inc_vat:0,vat_amount:0}]}
 assert.equal((await service.getCanonicalCustomerResource('invoices')).data[0].total_amount,0)
 const {GET: meteringGet} = await import('../app/api/web/customer/metering-values/route.ts')
 globalThis.__auditRegression.fetchResource = fetchOpsCustomerResource
 const meteringPath = 'https://gridex.invalid/api/web/customer/metering-values'
 const dates = { from: '2026-11-01T00:00:00Z', to: '2026-11-02T00:00:00Z' }
 const meterA = '735999123456789012'
 const meterB = '735999123456789013'
 const nextCursor = 'next+/='
 let meterCalls = 0
 globalThis.fetch = async (url, init) => {
  const request = new URL(url)
  assert.equal(request.pathname, '/api/v1/customer/metering-values')
  assert.equal(new Headers(init.headers).get('x-gridex-auth-user-id'), uid)
  const pageIndex = meterCalls++
  const firstPage = pageIndex === 0
  assert.deepEqual(Object.fromEntries(request.searchParams), {
   ...dates, facility_id: pageIndex < 2 ? meterA : meterB, limit: '2', ...(pageIndex === 1 ? { cursor: nextCursor } : {}),
  })
  const data = ['point_one', 'point_two'].map((point, index) => ({
   metering_value_reference: `value_${index}`, metering_point_reference: point,
   period_start: dates.from, period_end: '2026-11-01T00:15:00Z', resolution: 'quarter',
   status: 'stored', quality_status: index ? 'estimated' : 'measured', quantity_kwh: pageIndex + 2,
  }))
  return Response.json({ data, page: { returned: 2, limit: 2, offset: 0, has_more: firstPage,
   next_cursor: firstPage ? nextCursor : null }, request_id: 'offline-metering', contract_schema_version: WIRE })
 }
 for (const invalid of ['from=2026-02-30', 'cursor=x&cursor=y', 'customer_number=other',
  'from=2026-11-02&to=2026-11-01', 'facility_id=unknown', 'limit=101']) {
  assert.equal((await meteringGet(new Request(`${meteringPath}?${invalid}`))).status, 400)
 }
 assert.equal(meterCalls, 0)
 const getMetering = async (facility_id, cursor) => {
  const query = new URLSearchParams({ ...dates, facility_id, limit: '2', ...(cursor ? { cursor } : {}) })
  const response = await meteringGet(new Request(`${meteringPath}?${query}`))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  return response.json()
 }
 const firstMetering = await getMetering(meterA)
 assert.deepEqual(firstMetering.page, { hasMore: true, nextCursor })
 assert.deepEqual(firstMetering.data.map(row => [row.metering_point_reference, row.resolution, row.status, row.quality]),
  [['point_one', 'quarter', 'stored', 'measured'], ['point_two', 'quarter', 'stored', 'estimated']])
 const secondMetering = await getMetering(meterA, firstMetering.page.nextCursor)
 assert.deepEqual(secondMetering.page, { hasMore: false, nextCursor: null })
 assert.ok(secondMetering.data.every(row => row.quantity_kwh === 3))
 const otherFacility = await getMetering(meterB)
 assert.ok(otherFacility.data.every(row => row.quantity_kwh === 4))
 assert.equal(meterCalls, 3)
 delete globalThis.__auditRegression.fetchResource
 globalThis.__auditRegression.bundle={profile:{email:user.email},contracts:[],sites:[],invoices:[],documents:[],legalAcceptances:[],powersOfAttorney:[],switchStatus:null,customerStatus:null,dataQuality:null,meteringValues:[],events:[],notifications:[]}
 let profileReads=0
 const profileFrom=globalThis.__auditRegression.db.from
 globalThis.__auditRegression.db.from=(...args)=>{profileReads++;return profileFrom(...args)}
 const overview=await service.getCustomerPortalOverview();assert.ok(overview.authoritative);assert.ok(overview.supportError)
 assert.equal(profileReads,1,'the overview and optional support reuse one verified profile identity')
 const {default: ContractsPage} = await import('../app/dashboard/contracts/page.tsx')
 const contractBundle = globalThis.__auditRegression.bundle
 for (const [terms, direction, renewal] of [
  [{ energy_direction: 'production', auto_renew_enabled: true }, 'Produktion', 'Ja'],
  [{ energy_direction: 'consumption', auto_renew_enabled: false }, 'Förbrukning', 'Nej'],
  [{}, 'Inväntas', 'Inväntas'],
 ]) {
  contractBundle.contracts = [{ contract_reference: 'contract_terms', status: 'active', ...terms }]
  const html = renderToStaticMarkup(await ContractsPage())
  assert.match(html, new RegExp(`Energiriktning</[^>]+><[^>]+>${direction}</`))
  assert.match(html, new RegExp(`Automatisk förlängning</[^>]+><[^>]+>${renewal}</`))
 }
 globalThis.__auditRegression.db.from=()=>({update(){return this},eq(){return this},lt:async()=>({error:{message:'Modeled outage'}})})
 const {GET}=await import('../app/auth/confirm/route.ts');const {NextRequest}=await import('next/server.js')
 const callback=await GET(new NextRequest('https://gridex.invalid/auth/confirm?token_hash=offline&type=email'))
 assert.equal(callback.status,307);assert.equal(new URL(callback.headers.get('location')).searchParams.get('portal_link'),'pending')
 const db = globalThis.__auditRegression.db
 const queued = { user_id: user.id, email: user.email, otp_type: 'email', status: 'pending', attempt_count: 0, max_attempts: 5 }
 let attempts = 0
 let persistedJob = null
 db.rpc = async (name, args) => {
  assert.equal(args.p_user_id, user.id)
  if (name === 'gridex_enqueue_auth_profile_v1') {
   persistedJob = { ...queued }
   return { data: persistedJob, error: null }
  }
  assert.equal(name, 'gridex_commit_auth_profile_v1')
  persistedJob.status = 'completed'
  return { data: true, error: null }
 }
 db.from = (table) => {
  assert.equal(table, 'auth_profile_sync_jobs')
  return {
   update() { return this }, select() { return this }, eq() { return this }, in() { return this },
   lte() { return this }, order() { return this }, limit() { return this },
   lt: async () => ({ error: null }),
   maybeSingle: async () => ++attempts === 1
    ? { data: null, error: { message: 'Modeled claim failure' } }
    : { data: { user_id: user.id }, error: null },
   returns: async () => ({ data: [persistedJob], error: null }),
  }
 }
 const claimFailure = await GET(new NextRequest('https://gridex.invalid/auth/confirm?token_hash=offline&type=email&next=%2Fmina-sidor'))
 assert.equal(claimFailure.status, 307)
 assert.equal(new URL(claimFailure.headers.get('location')).pathname, '/mina-sidor')
 assert.equal(new URL(claimFailure.headers.get('location')).searchParams.get('portal_link'), 'pending')
 assert.equal(persistedJob.status, 'pending')
 const { processAuthProfileSyncJobs } = await import('../lib/customerPortal/authProfileSync.ts')
 assert.deepEqual(await processAuthProfileSyncJobs(), { processed: 1, completed: 1, failed: 0 })
 assert.equal(persistedJob.status, 'completed')
 let recoverySession = null
 let recoveryReads = 0
 globalThis.__auditRegression.observeOnboardingResume = () => { recoveryReads++ }
 globalThis.__auditRegression.db.auth.verifyOtp = async ({ type }) => {
  assert.equal(type, 'recovery')
  return { data: { session: recoverySession }, error: null }
 }
 globalThis.__auditRegression.db.auth.getUser = async () => { recoveryReads++; throw Error('Redundant Auth read') }
 globalThis.__auditRegression.db.from = () => { recoveryReads++; throw Error('Portal work must not block recovery') }
 const recoveryUrl = 'https://gridex.invalid/auth/confirm?token_hash=offline&type=recovery'
 const missingRecoverySession = await GET(new NextRequest(recoveryUrl))
 assert.equal(new URL(missingRecoverySession.headers.get('location')).pathname, '/login/forgot-password')
 recoverySession = { user }
 const recovery = await GET(new NextRequest(recoveryUrl))
 assert.equal(recovery.status, 307)
 assert.equal(new URL(recovery.headers.get('location')).pathname, '/login/reset-password')
 assert.equal(recoveryReads, 0)
 delete globalThis.__auditRegression.observeOnboardingResume
 console.log('Checkout processing, portal DTOs, zero vs unknown invoices, support isolation and post-OTP database outage regressions passed')
 globalThis.__auditProbes=[]
 const {checkOpsCustomerPortalReadiness}=await import('../lib/ops/portalReadiness.ts')
 const readiness=await checkOpsCustomerPortalReadiness()
 assert.equal(readiness.ready,true);assert.equal(readiness.support.ready,false)
 assert.deepEqual(globalThis.__auditProbes.filter(p=>p.path.includes('/support/')).map(p=>p.init.method),['GET','POST'])
 const {checkRateLimit,clientIpFromHeaders}=await import('../lib/security/rateLimit.ts')
 const beforeEnvironment=process.env.NODE_ENV;process.env.NODE_ENV='production'
 delete process.env.SUPABASE_SERVICE_ROLE_KEY
 assert.equal((await checkRateLimit('offline-critical-route',{limit:1,windowMs:1000})).source,'unavailable')
 assert.equal((await checkRateLimit('offline-critical-route',{limit:1,windowMs:1000})).allowed,false)
 process.env.VERCEL='1'
 assert.equal(clientIpFromHeaders(new Headers({'x-forwarded-for':'attacker','x-vercel-forwarded-for':'trusted-edge'})),'trusted-edge')
 delete process.env.VERCEL;process.env.NODE_ENV=beforeEnvironment
 const {processPublicSupportReceipts}=await import('../lib/customerPortal/publicSupportReceipts.ts')
 process.env.GRIDEX_SUPPORT_RECEIPT_RESEND_KEY='offline-provider-key';process.env.GRIDEX_SUPPORT_RECEIPT_FROM='Gridex <receipt@example.invalid>'
 const receipt={operation_id:uid,recipient:'customer@example.invalid',body:'Syntetiskt test',claim_token:'claim-a',attempt_count:1,first_attempt_at:new Date().toISOString()}
 let patch,providerKeys=[],providerBodies=[]
 globalThis.__auditRegression.db={rpc:async()=>({data:[receipt],error:null}),from:()=>({update(value){patch=value;return this},eq(){return this},select(){return this},maybeSingle:async()=>({data:{operation_id:uid},error:null})})}
 globalThis.fetch=async(_url,init)=>{providerKeys.push(init.headers['Idempotency-Key']);providerBodies.push(init.body);return new Response('{}',{status:503})}
 assert.equal((await processPublicSupportReceipts()).failed,1);assert.equal(patch.status,'failed')
 receipt.attempt_count=2;receipt.claim_token='claim-b'
 globalThis.fetch=async(_url,init)=>{providerKeys.push(init.headers['Idempotency-Key']);providerBodies.push(init.body);return new Response(JSON.stringify({id:'provider-offline'}),{status:200})}
 assert.equal((await processPublicSupportReceipts()).sent,1);assert.equal(patch.status,'sent');assert.equal(patch.provider_message_id,'provider-offline')
 assert.equal(providerKeys[0],providerKeys[1]);assert.equal(providerBodies[0],providerBodies[1])
 receipt.first_attempt_at=new Date(Date.now()-24*60*60_000).toISOString()
 globalThis.fetch=async()=>{throw new Error('Expired idempotency must not be resent')}
 await processPublicSupportReceipts();assert.equal(patch.status,'manual_review')
 const {createAgreementAction}=await import('../lib/contracts/createAgreement.ts')
 await assert.rejects(()=>createAgreementAction(new FormData()),/avvecklad/)
 console.log('Separate support readiness, fail-closed rate limiting and durable provider idempotency regressions passed')
} finally { globalThis.fetch=originalFetch }

{
 const { updateCustomerProfileAction } = await import('../app/dashboard/profile/actions.ts')
 const operations = []
 const baseline = { userId: 'synthetic-user', first_name: 'Tidigare', last_name: '', phone: '0700000000', language_code: 'sv' }
 let localError = null
 let remoteError = null
 globalThis.__auditRegression = { db: {
  auth: { getUser: async () => ({ data: { user: { id: baseline.userId } } }) },
  from: table => ({
   update(patch) { operations.push({ table, patch }); return this },
   eq(field, id) { assert.equal(field, 'user_id'); assert.equal(id, baseline.userId); return this },
   select() { return this },
   async maybeSingle() { return { data: localError ? null : { user_id: baseline.userId }, error: localError } },
  }),
 } }
 globalThis.__profileUpdate = {
  async submit({ profile }) {
   if (remoteError) throw remoteError
   operations.push({ target: 'ops', profile })
   return { ok: true, data: { profile_updated: true } }
  },
 }
 const form = new FormData()
 for (const [key, value] of Object.entries({ first_name: 'Ny', last_name: '', phone: baseline.phone, language_code: 'sv', client_operation_id: 'profile-update:offline' })) {
  form.set(key, value)
 }
 const run = (status, from = baseline) =>
  assert.rejects(updateCustomerProfileAction(from, form), { path: '/dashboard/profile?status=' + status })
 await run('profile-updated')
 assert.deepEqual(operations, [
  { target: 'ops', profile: { first_name: 'Ny' } },
  { table: 'customer_profiles', patch: { first_name: 'Ny' } },
 ])
 operations.length = 0
 await run('profile-reload', { ...baseline, userId: 'other-account' })
 assert.deepEqual(operations, [])
 form.set('first_name', baseline.first_name)
 await run('profile-unchanged')
 assert.deepEqual(operations, [])
 form.set('phone', '70+1234567')
 remoteError = Object.assign(new Error('Invalid phone number'), { name: 'OpsError', status: 422, details: { field: 'phone' } })
 await run('profile-invalid-phone')
 assert.deepEqual(operations, [])
 remoteError = null
 localError = { code: 'synthetic_error' }
 await run('profile-local-sync-failed')
 console.log('Profile delta, field error and local synchronization checks passed')
}
