import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
const root = new URL('../../../', import.meta.url)
process.env.NEXT_PUBLIC_SUPABASE_URL='https://offline-audit.supabase.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-audit-key-never-sent'
let rows = ['SE1','SE2','SE3','SE4'].map(price_area=>({price_area,price_per_kwh_ore:100}))
const db = { from(table){
  assert.equal(table,'contract_area_pricing')
  return {delete(){return {async eq(){rows=[];return {error:null}}}},
    async insert(){return {error:{message:'synthetic insert failed after committed deletion'}}}}
} }
globalThis.__pricingAudit = {db,admin:{userId:'offline-audit-admin',isAdmin:true,roles:['admin'],permissions:['pricing.write']}}
const { savePricingAction } = await import(new URL('app/admin/pricing/[slug]/actions.ts',root))
const form = new FormData()
form.set('pricing_version_id','version_audit');form.set('contract_type','fixed')
for(const area of ['SE1','SE2','SE3','SE4'])form.set(area+'_price_per_kwh_ore','100')
await assert.rejects(savePricingAction(form),/synthetic insert failed/)
assert.equal(rows.length,0)
console.log('CONFIRMED F27: real save action commits deletion before failing insertion; previous four area-price rows are lost at modeled DB boundary')

globalThis.__pricingAudit.db = {from(table){
  assert.equal(table,'contract_agreements')
  const query={update(){return this},eq(){return this},is(){return this},select(){return this},async maybeSingle(){return {data:null,error:null}}}
  return query
}}
const {default:EmailSign} = await import(new URL('app/sign/email/[token]/page.tsx',root))
const page = await EmailSign({params:Promise.resolve({token:'synthetic-invalid-token'})})
const html = renderToStaticMarkup(page)
assert.ok(html.includes('Avtalet är signerat'))
console.log('CONFIRMED F31: real email-sign page reports signed when query returns no matching agreement')

const {fetchMonthlySpotAverageFromElprisetJustNu} = await import(new URL('lib/gridex/pricing/elprisetjustnu.ts',root))
const originalFetch = globalThis.fetch
try {
 let calls=0
 globalThis.fetch = async url=>{
  calls++
  const day=Number(String(url).match(/09-(\d+)_/)[1])
  const start=Date.parse(`2026-09-${String(day).padStart(2,'0')}T00:00:00+02:00`)
  const entries=Array.from({length:24},(_,i)=>({SEK_per_kWh:1,
   time_start:new Date(start+i*3600000).toISOString(),time_end:new Date(start+(i+1)*3600000).toISOString()}))
  return new Response(JSON.stringify(entries))
 }
 const average=await fetchMonthlySpotAverageFromElprisetJustNu({year:2026,month:9,priceArea:'SE3'})
 assert.equal(calls,30);assert.equal(average.avgSpotOre,100)
 console.log('CONFIRMED F29: one monthly average fans out to 30 daily fetches; four-area page schedules 120 monthly fetches plus 4 live fetches before cache effects')
} finally {globalThis.fetch=originalFetch}
