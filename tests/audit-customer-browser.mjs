// Run only against the isolated customer fixture on localhost. All service calls are mocked.
import assert from 'node:assert/strict'
import {chromium} from 'playwright'
const origin = process.env.GRIDEX_AUDIT_ORIGIN ?? 'http://127.0.0.1:3211'
const browser=await chromium.launch({headless:true})
try {
 const page=await browser.newPage()
 const moves=[], support=[]
 let syncCalls=0
 const documentCalls=[], archiveCalls=[]
 const attachmentCalls = new Map()
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url())
  if(url.hostname==='audit.invalid'&&url.pathname==='/auth/v1/recover')return route.fulfill({status:429,json:{code:'over_email_send_rate_limit',msg:'Email rate limit exceeded for this user'}})
  if(url.hostname!=='127.0.0.1')return route.abort()
  if(url.pathname==='/api/web/customer-portal/sync'){syncCalls++;return syncCalls===1?route.fulfill({contentType:'text/html',body:'<html>Unexpected proxy response</html>'}):route.fulfill({json:{data:{ok:false,status:'pending_review',synced:{access_granted:false}},queued:false}})}
  if(url.pathname==='/api/web/customer/notifications/read')return route.fulfill({json:{ok:true,queued:false,opsSynced:true,localSynced:true}})
  if(url.pathname==='/api/support/public'){support.push(route.request().postDataJSON());return support.length===1?route.fulfill({status:503,json:{error:'Syntetiskt osäkert svar'}}):route.fulfill({json:{ok:true,ticketId:'synthetic-ticket',confirmation_status:'queued'}})}
  if(url.pathname==='/api/web/customer/move-out'){
   moves.push(route.request().postDataJSON())
   return moves.length===1?route.fulfill({status:503,json:{error:'Syntetiskt osäkert svar efter mottagen operation'}}):route.fulfill({json:{
    data:{ok:true,status:'submitted'},queued:false,moveOutReceipt:{
     completion_reference:'synthetic-move-receipt',status:'submitted',
     facility_reference:moves.at(-1).move_out.facility_reference,
     requested_move_out_date:moves.at(-1).move_out.move_out_date,
    },
   }})
  }
  if (url.pathname === '/api/web/customer/documents') {
   documentCalls.push(url.searchParams.get('cursor'))
   return route.fulfill({json:{data:[{id:'document-two',title:'Ordinarie dokument sida två'}],page:{hasMore:false,nextCursor:null}}})
  }
  if (url.pathname === '/api/web/customer/powers-of-attorney/evidence') {
   archiveCalls.push(url.searchParams.get('cursor'))
   return route.fulfill({json:{data:[{power_of_attorney_reference:'poa-two',verification_reference:'arkiv-sida-två',archive_status:'missing'}],
    page:{has_more:false,next_cursor:null}}})
  }
  if (url.pathname === '/api/audit/customer-attachment' || url.pathname === '/api/audit/staff-attachment') {
   const request = route.request()
   const keys = attachmentCalls.get(url.pathname) ?? []
   keys.push(request.headers()['idempotency-key'])
   attachmentCalls.set(url.pathname, keys)
   if (keys.length === 1) return route.fulfill({ status: 200, contentType: 'text/html', body: '<html>Proxy</html>' })
   if (keys.length === 2) return route.fulfill({ status: 201, contentType: 'application/json', body: 'invalid JSON' })
   if (keys.length === 3) return route.fulfill({ status: 201, json: { ok: false } })
   return route.fulfill({ status: 201, json: { ok: true } })
  }
  if(url.pathname.startsWith('/api/'))return route.fulfill({json:{data:null,authenticated:false}})
  return route.continue()
 })
 await page.goto(origin+'/audit-customer',{waitUntil:'networkidle',timeout:60000})

 await page.waitForFunction(()=>document.documentElement.dataset.auditReady==='true')
 await page.getByRole('button',{name:'Uppdatera Mina sidor',exact:true}).click()
 await page.getByText('Svaret kunde inte bekräftas. Försök igen med samma uppgifter.',{exact:true}).waitFor()
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
 await page.getByText(/Flyttanmälan är skickad.*synthetic-move-receipt/).waitFor()
 assert.equal(moves.length,2);assert.equal(moves[0].client_operation_id,moves[1].client_operation_id)
 assert.deepEqual(moves[0].move_out,moves[1].move_out)
 console.log('PASSED F38: unchanged move-out retry preserves its operation ID across page reload')
 await page.locator('input[type=email]').first().fill('customer@example.invalid')
 await page.getByRole('button',{name:'Skicka återställningslänk',exact:true}).click()
 await page.getByText('För många försök. Vänta en stund innan du begär en ny återställningslänk.',{exact:true}).waitFor()
 console.log('PASSED F41/W01: recovery rate limits with user wording display a wait instruction')
 await page.getByRole('button',{name:'Markera som läst',exact:true}).click()
 await page.getByText('Senaste meddelandet är oläst.',{exact:true}).waitFor({state:'hidden'})
 console.log('PASSED W06: confirmed notification read removes unread label')
 for(let attempt=0;attempt<2;attempt++){
  await page.locator('#name').fill('Testkund')
  await page.locator('#email').fill('customer@example.invalid')
  await page.locator('#subject').fill('Testärende')
  await page.locator('#message').fill('Testmeddelande')
  assert.equal(await page.locator('#message').getAttribute('maxlength'),'4000')
  await page.getByRole('button',{name:'Skicka ärende',exact:true}).click()
  if(attempt===0){await page.getByText('Syntetiskt osäkert svar',{exact:true}).waitFor();await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>document.documentElement.dataset.auditReady==='true')}
 }
 await page.getByText('Tack! Ditt ärende har skickats.',{exact:true}).waitFor()
 assert.equal(support.length,2);assert.equal(support[0].client_operation_id,support[1].client_operation_id)
 console.log('PASSED W02/W03: support limits and durable retry identity in browser')
 await page.getByRole('link', { name: 'Visa fler fullmakter' }).click()
 await page.getByText('Verifikationsnummer: arkiv-sida-två').waitFor()
 assert.deepEqual(documentCalls, [])
 await page.getByRole('link', { name: 'Visa fler dokument' }).click()
 await page.getByText('Ordinarie dokument sida två').waitFor()
 assert.equal(await page.getByText('Verifikationsnummer: arkiv-sida-två').count(),1)
 assert.deepEqual(documentCalls,['documents-next'])
 assert.deepEqual(archiveCalls,['archive-next'])
 console.log('PASSED GW25: ordinary documents and power-of-attorney archives paginate independently')
 for (const kind of ['customer-attachment', 'staff-attachment']) {
  const form = page.getByTestId(kind)
  const file = form.locator('input[name=file]')
  await file.setInputFiles({ name: 'audit.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-synthetic') })
  const send = form.getByRole('button', { name: 'Skicka bilaga' })
  for (let attempt = 0; attempt < 3; attempt++) {
   await send.click()
   const failure = form.getByText('Uppladdningen kunde inte bekräftas. Försök igen med samma fil.', { exact: true })
   await failure.waitFor()
   assert.equal(await failure.getAttribute('role'), 'alert')
   assert.equal(await file.evaluate(input => input.files.length), 1)
  }
  await send.click()
  const success = form.getByText('Bilagan har skickats för innehållskontroll.', { exact: true })
  await success.waitFor()
  assert.equal(await success.getAttribute('role'), 'status')
  assert.equal(await file.evaluate(input => input.files.length), 0)
  const keys = attachmentCalls.get('/api/audit/' + kind)
  assert.equal(keys.length, 4)
  assert.ok(keys[0])
  assert.equal(new Set(keys).size, 1)
 }
 console.log('PASSED GW21: both attachment forms preserve the file and operation ID until a valid receipt')
}finally{await browser.close()}
