import assert from 'node:assert/strict'
import {renderToStaticMarkup} from 'react-dom/server'
const root = new URL('../../../',import.meta.url)
const userId='11111111-1111-4111-8111-111111111111'
globalThis.fetch=()=>{throw new Error('Outbound network is prohibited in this proof')}
const state=globalThis.__customerAudit={resource:null,db:null}
const profile={user_id:userId,email:'customer@example.invalid',external_customer_id:'customer_audit',customer_number:'C-AUDIT'}
function resourceDb(){return {auth:{async getUser(){return {data:{user:{id:userId,email:profile.email}},error:null}}},from(){return {select(){return this},eq(){return this},async maybeSingle(){return {data:profile,error:null}}}}}}
state.db=resourceDb()
const service=await import(new URL('lib/customerPortal/service.ts',root))
const portal=await import(new URL('lib/ops/client/portal.ts',root))
await assert.rejects(()=>portal.markOpsCustomerNotificationsRead({userId,email:profile.email,externalCustomerId:'customer_audit'},
 {notificationIds:['notification_abcdefghijklmnopqrstuvwx'],operationId:'audit-read-notification'}),error=>{
 assert.equal(error.name,'OpsSchemaError'); assert.match(JSON.stringify(error.details),/notification_references|notification_ids/);return true
})
console.log('CONFIRMED F32: actual notification-read client fails OpenAPI request validation before any outbound fetch')

state.resource={sites:[{facility_reference:'facility_abcdefghijklmnopqrstuvwx',facility_id:'735999111222333444',
 status:'active',address:{street:'Testgatan 1',postal_code:'11122',city:'Teststad',country:'SE'},price_area:'SE3',grid_area_code:'AUDIT'}]}
await assert.rejects(()=>service.getCanonicalCustomerResource('sites'),/PORTAL_SITE_REFERENCE_MISSING|site_reference/)
console.log('CONFIRMED F33: actual site mapper rejects OPS facility_reference and cannot consume its nested address')

state.resource={documents:[{document_reference:'document_abcdefghijklmnopqrstuvwx',document_type:'contract',title:'Syntetiskt avtal',
 status:'available',secure_url:'https://example.invalid/audit-document.pdf',version:'v-audit',created_at:'2026-10-06T10:00:00Z'}]}
const docs=await service.getCanonicalCustomerResource('documents')
assert.equal(docs.data[0].download_url,null);assert.equal(docs.data[0].version,null)
const {default: DocumentsPage}=await import(new URL('app/dashboard/documents/page.tsx',root))
const html=renderToStaticMarkup(await DocumentsPage())
assert.equal(html.includes('Öppna dokument'),false)
console.log('CONFIRMED F34: actual document mapper drops secure_url and version; real documents page has no open-document action')

const {syncFacilityData}=await import(new URL('lib/customerPortal/writeValidation.ts',root))
const facility=syncFacilityData({site_id:'facility_abcdefghijklmnopqrstuvwx',facility_id:'735999111222333444',grid_area_code:'AUDIT',price_area_code:'SE3'})
assert.equal(facility[0].grid_area_code,undefined);assert.equal(facility[0].price_area_code,undefined)
console.log('CONFIRMED F35: self-service submitted grid-area and price-area fields are silently discarded before OPS')

state.resource={legal_acceptances:[{acceptance_reference:'acceptance_abcdefghijklmnopqrstuvwx',acceptance_type:'terms',
 document_reference:'legal_document_abcdefghijklmnopqrstuvwx',document_version:'v-audit',document_hash:'a'.repeat(64),accepted_at:'2026-10-06T10:00:00Z'}]}
const legal=await service.getCanonicalCustomerResource('legal-acceptances')
assert.equal(legal.data[0].version,null)
state.resource={powers_of_attorney:[{power_of_attorney_reference:'power_of_attorney_abcdefghijklmnopqrstuvwx',scope:'facility_data_request',status:'active',valid_to:'2026-12-31'}]}
const poa=await service.getCanonicalCustomerResource('powers-of-attorney')
assert.equal(poa.data[0].valid_until,null)
console.log('CONFIRMED F36: canonical legal document version and power-of-attorney valid_to are lost in portal mapping')

// Model only DB selection/mutation and Auth verification, execute the real queue and callback.
class Query{
 constructor(db,table){this.db=db;this.table=table;this.filters=[]}
 select(){return this} eq(k,v){this.filters.push(r=>r[k]===v);return this}
 in(k,vs){this.filters.push(r=>vs.includes(r[k]));return this}
 lt(k,v){this.filters.push(r=>r[k]!=null&&r[k]<v);return this}
 lte(k,v){this.filters.push(r=>r[k]!=null&&r[k]<=v);return this}
 update(p){this.patch=p;return this} upsert(rows){this.insert=Array.isArray(rows)?rows:[rows];return this}
 limit(){return this} order(){return this} returns(){return this}
 maybeSingle(){return this.execute(true)} single(){return this.execute(true)}
 then(resolve,reject){return this.execute(false).then(resolve,reject)}
 async execute(single){
  if(this.db.failRecovery&&this.table==='auth_profile_sync_jobs'&&this.patch?.last_error?.startsWith('Recovered'))return {data:null,error:{message:'modeled database recovery outage'}}
  const table=this.db.tables[this.table];assert.ok(table,'Unexpected DB table '+this.table)
  let rows=table.filter(r=>this.filters.every(f=>f(r)))
  if(this.insert){for(const row of this.insert){const id=row.user_id??row.id;const exists=table.find(r=>(r.user_id??r.id)===id);if(exists)Object.assign(exists,row);else table.push({...row})}rows=this.insert}
  if(this.patch)for(const r of rows)Object.assign(r,this.patch)
  return {data:single?rows[0]??null:rows,error:null}
 }
}
function queueDb(){const db={tables:{auth_profile_sync_jobs:[],customer_profiles:[],user_profiles:[]},failRecovery:false,
 auth:{async verifyOtp(){db.otpVerified=true;return {data:{},error:null}},async getUser(){return {data:{user:{id:userId,email:'new@example.invalid'}},error:null}}},
 from(table){return new Query(db,table)}};return db}
state.db=queueDb();state.db.failRecovery=true
const {GET}=await import(new URL('app/auth/confirm/route.ts',root))
const {NextRequest}=await import('next/server.js')
await assert.rejects(()=>GET(new NextRequest('https://gridex.invalid/auth/confirm?token_hash=synthetic-hash&type=email')),/modeled database recovery outage/)
assert.equal(state.db.otpVerified,true)
console.log('CONFIRMED F39: real confirmation callback verifies OTP then throws on stale-job recovery instead of redirecting safely')

state.db=queueDb()
const job={user_id:userId,email:'old@example.invalid',otp_type:'email_change',status:'processing',attempt_count:1,max_attempts:10,locked_at:new Date().toISOString(),next_attempt_at:new Date().toISOString()}
state.db.tables.auth_profile_sync_jobs.push(job)
const sync=await import(new URL('lib/customerPortal/authProfileSync.ts',root))
const queued=await sync.syncConfirmedUserProfileDurably({userId,email:'new@example.invalid',type:'email_change'})
assert.equal(queued.completed,false);assert.equal(job.email,'old@example.invalid')
job.status='retryable_failure';job.next_attempt_at=new Date().toISOString()
await sync.processAuthProfileSyncJobs()
assert.equal(state.db.tables.customer_profiles[0].email,'old@example.invalid');assert.equal(job.status,'completed')
console.log('CONFIRMED F40: newer confirmed email is not durably recorded while old sync job processes; retry writes old email and marks complete')

state.db=queueDb()
const successResponse=await GET(new NextRequest('https://gridex.invalid/auth/confirm?token_hash=synthetic-hash&type=email&next=%2Fmina-sidor'))
assert.equal(successResponse.headers.get('location'),'https://gridex.invalid/mina-sidor')
console.log('CONTROL PASSED: valid confirmation redirects safely when profile persistence works')
const invalidRedirect=await GET(new NextRequest('https://gridex.invalid/auth/confirm?token_hash=synthetic-hash&type=email&next=https%3A%2F%2Fexample.invalid'))
assert.equal(new URL(invalidRedirect.headers.get('location')).hostname,'gridex.invalid')
console.log('CONTROL PASSED: external next destination is rejected')
