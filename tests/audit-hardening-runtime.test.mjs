import assert from 'node:assert/strict'
import {generateKeyPairSync,verify} from 'node:crypto'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {opsRequest} from '../lib/ops/transport.ts'
import {signCustomerAssertion} from '../lib/ops/customerAssertion.ts'
import {mapOpsWebsiteQuote} from '../lib/ops/client/core.ts'
import {mapOpsCustomerApplicationResult,assertAcceptedApplication} from '../lib/ops/client/application.ts'
import {markOpsCustomerNotificationsRead} from '../lib/ops/client/portal.ts'
import {assertWebsiteResponse} from '../lib/ops/validators/openapi.ts'
import {stockholmDayBounds} from '../lib/website/businessDate.ts'
import {fetchDailySpotAverageFromElprisetJustNu,fetchMonthlySpotAverageFromElprisetJustNu} from '../lib/gridex/pricing/elprisetjustnu.ts'
import {getLivePriceSummary} from '../lib/gridex/livePrices.ts'
import {issueWebsitePricingQuote,verifyWebsitePricingQuote,validateWebsitePricingQuote} from '../lib/website/pricingQuote.ts'
import PriceResultCard from '../components/PriceResultCard.tsx'
import {buildPublicContractDisplay} from '../lib/website/publicContractDisplay.ts'
import {createWebsiteApplicationResult,readWebsiteApplicationResultState} from '../lib/website/applicationResultStore.ts'
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
 globalThis.fetch=async()=>({status:200,ok:true,headers:new Headers({'content-type':'application/json'}),json:()=>new Promise(()=>{})})
 const before=Date.now()
 await assert.rejects(()=>opsRequest('/api/v1/customer/me'),e=>e.status===504&&e.code==='ops_request_timeout')
 assert.ok(Date.now()-before<1800,'body read must remain inside the configured deadline')
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
  return new Response(JSON.stringify({data:{updated_count:1,notification_references:body.notification_references,read_at:'2026-10-06T12:00:00Z'},request_id:'offline',contract_schema_version:'2026-10-04.1'}),{headers:{'Content-Type':'application/json'}})
 }
 await markOpsCustomerNotificationsRead({userId:uid,externalCustomerId:'customer_offline'}, {notificationIds:['notification_abcdefghijklmnopqrstuvwx'],operationId:'offline-operation'})
 console.log('Transport, notification contract and signed customer assertion regressions passed')
const input = { resolution_id: 'resolution_audit_price', offer_reference: 'offer_audit_price',
  annual_consumption_kwh: 1200, start_date: '2026-10-06', price_option_reference: 'option_audit_price',
  invoice_delivery_method: 'e_invoice', selected_component_references: [], site_count: 1,
  requested_start_mode: 'specific_date', customer_type: 'private' }
const payload = { request_id: 'offline-pricing-audit', contract_schema_version: '2026-10-04.1', data: {
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
 globalThis.__auditResultDb={from:()=>({upsert:async()=>({error:null})})}
 const receiptInput={submissionAttemptId:'22222222-2222-4222-8222-222222222222',userId:null,receivedAt:now,result:{checkout,applicationNumber:'APP-TEST',energyDirection:'consumption',signedAt:null}}
 const pendingToken=await createWebsiteApplicationResult(receiptInput)
 const pendingReceipt=await readWebsiteApplicationResultState(pendingToken)
 assert.equal(pendingReceipt.status,'verified')
 assert.equal(pendingReceipt.result.signedAt,null)
 assert.equal(Date.parse(pendingReceipt.expiresAt),Date.parse(now)+24*60*60*1000)
 assert.equal(await createWebsiteApplicationResult(receiptInput),pendingToken,'same attempt and immutable receipt must preserve the token')
 await assert.rejects(()=>createWebsiteApplicationResult({...receiptInput,receivedAt:undefined}),/timestamp/)
 await assert.rejects(()=>createWebsiteApplicationResult({...receiptInput,receivedAt:'invalid'}),/timestamp/)
 delete process.env.WEBSITE_RESULT_TOKEN_SECRET
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
 globalThis.__auditRegression.bundle={profile:{email:user.email},contracts:[],sites:[],invoices:[],documents:[],legalAcceptances:[],powersOfAttorney:[],switchStatus:null,customerStatus:null,dataQuality:null,meteringValues:[],events:[],notifications:[]}
 let profileReads=0
 const profileFrom=globalThis.__auditRegression.db.from
 globalThis.__auditRegression.db.from=(...args)=>{profileReads++;return profileFrom(...args)}
 const overview=await service.getCustomerPortalOverview();assert.ok(overview.authoritative);assert.ok(overview.supportError)
 assert.equal(profileReads,1,'the overview and optional support reuse one verified profile identity')
 globalThis.__auditRegression.db.from=()=>({update(){return this},eq(){return this},lt:async()=>({error:{message:'Modeled outage'}})})
 const {GET}=await import('../app/auth/confirm/route.ts');const {NextRequest}=await import('next/server.js')
 const callback=await GET(new NextRequest('https://gridex.invalid/auth/confirm?token_hash=offline&type=email'))
 assert.equal(callback.status,307);assert.equal(new URL(callback.headers.get('location')).searchParams.get('portal_link'),'pending')
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
