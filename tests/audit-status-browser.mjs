import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const browser=await chromium.launch({headless:true})
const origin=process.env.GRIDEX_AUDIT_ORIGIN ?? 'http://127.0.0.1:3211'
try {
 const page=await browser.newPage()
 let applications=0,switches=0
 await page.clock.install()
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort()
  if(url.pathname.startsWith('/api/checkout/applications/')){
   applications++
   return route.fulfill({json:{data:{status:'completed',stage:'test',missing_customer_action:false,updated_at:null,checkout:{page_state:applications===1?'processing':'success',customer_action_required:false,confirmation_email:{expected:true,status:applications===1?'queued':'delivered'}}}}})
  }
  if(url.pathname==='/api/checkout/switch-status'){
   switches++;return route.fulfill({status:410,json:{error:{code:'expired_result'}}})
  }
  return route.continue()
 })
 await page.goto(origin+'/audit-status',{waitUntil:'networkidle',timeout:60000})
 await page.waitForFunction(()=>document.documentElement.dataset.auditReady==='true')
 await page.getByText('Avtalsbekräftelsen är köad.',{exact:true}).waitFor()
 assert.equal(await page.locator('[data-application-status]').getAttribute('data-application-status'),'processing')
 await page.clock.pauseAt(new Date(Date.now()+1000))
 await page.clock.runFor(60000)
 await page.getByText('Avtalsbekräftelsen har levererats till mottagarens mejlserver.',{exact:true}).waitFor()
 assert.equal(applications,2);assert.equal(switches,1)
 await page.clock.runFor(600000)
 assert.equal(applications,2);assert.equal(switches,1)
 console.log('PASSED F05/F13: checkout controls current display, email delivery refreshes, and terminal/expired states stop polling')
}finally{await browser.close()}
