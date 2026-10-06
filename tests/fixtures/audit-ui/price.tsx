'use client'
import { useEffect } from 'react'
import { useState } from 'react'
import ElectricityCalculator, {type ContractOption} from '@/components/ElectricityCalculator'
import type { WebsitePricingQuoteContext } from '@/lib/website/publicApi'
const contracts: ContractOption[] = [{name:'Syntetiskt avtal',value:'offer_audit',offerReference:'offer_audit',type:'fixed',customerTypes:['private']}]
const context: WebsitePricingQuoteContext = {postal_code:'11122',city:'Teststad',address:'Gammal gata 1',price_area_code:'SE3' as const,
  estimated_monthly_kwh:100,annual_consumption_kwh:1200,
  consumption_profile:{version:1 as const,source:'customer_entered' as const,annual_kwh:1200,monthly_kwh:100},
  price_option_reference:'option_audit',invoice_delivery_method:'e_invoice' as const,selected_component_references:[],
  site_count:1,requested_start_mode:'earliest_possible' as const,requested_start_date:null,
  quote_attempt_id:'11111111-1111-4111-8111-111111111111'}
export default function AuditPrice(){useEffect(()=>{document.documentElement.dataset.auditReady='true'},[]);
 const [result,setResult]=useState<unknown>(null)
 return <><ElectricityCalculator contracts={contracts} initialQuoteContext={context} onPricingPreviewChange={setResult}/><pre data-testid="audit-result">{JSON.stringify(result)}</pre></>
}
