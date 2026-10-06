// Run only against the isolated customer fixture on localhost. All service calls are mocked.
import assert from 'node:assert/strict'
import {chromium} from 'playwright'
const origin = process.env.GRIDEX_AUDIT_ORIGIN ?? 'http://127.0.0.1:3211'
const browser=await chromium.launch({headless:true})
try {
 const page=await browser.newPage()
 const moves=[]
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url())
  if(url.hostname==='audit.invalid'&&url.pathname==='/auth/v1/recover')return route.fulfill({status:429,json:{code:'over_email_send_rate_limit',msg:'Email rate limit exceeded'}})
  if(url.hostname!=='127.0.0.1')return route.abort()
  if(url.pathname==='/api/web/customer-portal/sync')return route.fulfill({json:{data:{ok:false,status:'pending_review',synced:{access_granted:false}},queued:false}})
  if(url.pathname==='/api/web/customer/move-out'){
   moves.push(route.request().postDataJSON())
   return moves.length===1?route.fulfill({status:503,json:{error:'Syntetiskt osäkert svar efter mottagen operation'}}):route.fulfill({json:{data:{ok:true,status:'accepted'},queued:false}})
  }
  if(url.pathname.startsWith('/api/'))return route.fulfill({json:{data:null,authenticated:false}})
  return route.continue()
 })
 await page.goto(origin+'/audit-customer',{waitUntil:'networkidle',timeout:60000})

 await page.waitForFunction(()=>document.documentElement.dataset.auditReady==='true')
 await page.getByRole('button',{name:'Uppdatera Mina sidor',exact:true}).click()
 await page.getByText('Kopplingen inväntar behandling. Tillgången till Mina sidor är ännu inte bekräftad.',{exact:true}).waitFor()
 console.log('PASSED F37: pending review is shown as pending')
 await page.locator('input[type=date]').fill('2026-12-06')
 await page.getByRole('button',{name:'Skicka flyttanmälan',exact:true}).click()
 await page.getByText('Syntetiskt osäkert svar efter mottagen operation',{exact:true}).waitFor()
 await page.reload({waitUntil:'networkidle'})
 await page.waitForFunction(()=>document.documentElement.dataset.auditReady==='true')
 await page.locator('input[type=date]').fill('2026-12-06')
 await page.getByRole('button',{name:'Skicka flyttanmälan',exact:true}).click()
 await page.getByText('Flyttanmälan är skickad.',{exact:true}).waitFor()
 assert.equal(moves.length,2);assert.equal(moves[0].client_operation_id,moves[1].client_operation_id)
 assert.deepEqual(moves[0].move_out,moves[1].move_out)
 console.log('PASSED F38: unchanged move-out retry preserves its operation ID across page reload')
 await page.locator('input[type=email]').fill('customer@example.invalid')
 await page.getByRole('button',{name:'Skicka återställningslänk',exact:true}).click()
 await page.getByText('För många försök. Vänta en stund innan du begär en ny återställningslänk.',{exact:true}).waitFor()
 console.log('PASSED F41: recovery rate limits display a wait instruction')
}finally{await browser.close()}
