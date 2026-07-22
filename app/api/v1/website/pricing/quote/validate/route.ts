import { NextResponse } from 'next/server'
import { validateOpsWebsiteQuote, type OpsWebsitePriceArea, isOpsError } from '@/lib/ops/client'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/security/rateLimit'
import { parseWebsiteCustomerType } from '@/lib/website/customerType'
import { verifyWebsitePricingQuote } from '@/lib/website/pricingQuote'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const AREAS = new Set<OpsWebsitePriceArea>(['SE1','SE2','SE3','SE4'])
const text=(v:unknown,max=180)=>typeof v==='string'?v.trim().slice(0,max):''

export async function POST(req: Request) {
  const rl=await checkRateLimit(`website-quote-validate:${clientIpFromHeaders(new Headers(req.headers))}`,{limit:30,windowMs:5*60_000})
  if(!rl.allowed) return NextResponse.json({ok:false,error:'För många kontroller. Vänta en stund och försök igen.'},{status:429,headers:{'Retry-After':String(Math.max(1,Math.ceil((rl.resetAt-Date.now())/1000)))}})
  const body=await req.json().catch(()=>null) as Record<string,unknown>|null
  const token=text(body?.quote_token,12000); const local=verifyWebsitePricingQuote(token)
  if(!local.ok) return NextResponse.json({ok:false,error:local.reason==='expired'?'Prisberäkningen har gått ut. Hämta ett nytt pris.':'Prisberäkningen är inte giltig.'},{status:409})
  const customerType=parseWebsiteCustomerType(body?.customer_type) ?? 'private'
  const area=text(body?.price_area_code).toUpperCase() as OpsWebsitePriceArea
  const annual=Number(body?.annual_consumption_kwh)
  const postal=text(body?.postal_code,20).replace(/\s+/g,'')
  const startDate=text(body?.start_date,20) || new Date().toISOString().slice(0,10)
  if(!AREAS.has(area)||!Number.isFinite(annual)||annual<=0||!/^\d{5}$/.test(postal)) return NextResponse.json({ok:false,error:'Prisberäkningen saknar canonical uppgifter.'},{status:400})
  try {
    const result=await validateOpsWebsiteQuote({quote_reference:local.quote.quote_reference,offer_reference:local.quote.contract.offer_reference,customer_type:customerType,postal_code:postal,price_area:area,grid_area_code:text(body?.grid_area_code)||null,annual_consumption_kwh:annual,start_date:startDate})
    return NextResponse.json({ok:true,quote_reference:result.quote_reference,valid_until:result.valid_until ?? local.quote.valid_until})
  } catch(error) {
    const code=isOpsError(error)&&error.details&&typeof error.details==='object'?(error.details as Record<string,unknown>).code:null
    const refresh=['quote_not_found','quote_expired','quote_revoked','quote_already_consumed','quote_mismatch','market_price_unavailable'].includes(String(code))
    return NextResponse.json({ok:false,code,error:refresh?'Prisberäkningen är inte längre giltig. Hämta ett nytt pris.':'Vi kunde inte kontrollera priset just nu.'},{status:refresh?409:503})
  }
}
