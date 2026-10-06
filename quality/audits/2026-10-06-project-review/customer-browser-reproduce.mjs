// Run only against the isolated customer fixture on localhost. All service calls are mocked.
import assert from 'node:assert/strict'
import {chromium} from 'playwright'
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
 await page.goto('http://127.0.0.1:3211/audit-customer',{waitUntil:'networkidle',timeout:60000})
 await page.getByRole('button',{name:'Uppdatera Mina sidor',exact:true}).click()
 await page.getByText('Kopplingen till Mina sidor är uppdaterad.',{exact:true}).waitFor()
 console.log('CONFIRMED F37: actual self-service reports portal link updated for pending_review and access_granted=false')
 await page.locator('input[type=date]').fill('2026-12-06')
 await page.getByRole('button',{name:'Skicka flyttanmälan',exact:true}).click()
 await page.getByText('Syntetiskt osäkert svar efter mottagen operation',{exact:true}).waitFor()
 await page.getByRole('button',{name:'Skicka flyttanmälan',exact:true}).click()
 await page.getByText('Flyttanmälan är skickad.',{exact:true}).waitFor()
 assert.equal(moves.length,2);assert.notEqual(moves[0].client_operation_id,moves[1].client_operation_id)
 assert.deepEqual(moves[0].move_out,moves[1].move_out)
 console.log('CONFIRMED F38: unchanged move-out retry uses a new operation ID and loses API idempotency protection')
 await page.locator('input[type=email]').fill('customer@example.invalid')
 await page.getByRole('button',{name:'Skicka återställningslänk',exact:true}).click()
 await page.getByText('Ange en giltig e-postadress.',{exact:true}).waitFor()
 console.log('CONFIRMED F41: provider email rate limit is shown as invalid customer email by actual password recovery page')
}finally{await browser.close()}
