import assert from 'node:assert/strict'
import {beforeEach,test} from 'node:test'
import {getAdminContext} from '../lib/admin/getAdminContext.ts'
import {requireAdminPageAccess,requireAdminActionAccess} from '../lib/admin/guards.ts'
import {hasPermission} from '../lib/admin/permissions.ts'
import {POST as replay} from '../app/api/admin/customer-portal/outbox/route.ts'
import {POST as cis} from '../app/api/admin/cis/actions/route.ts'

const user={id:'11111111-1111-4111-8111-111111111111',email:'staff@example.invalid'}
let permissions,roles,signedIn,readError
beforeEach(()=>{
 permissions=['support_tickets.manage'];roles=[{role:'staff',is_active:true}];signedIn=true;readError=null
 globalThis.__adminBoundary={privilegedWrites:0,client:{auth:{getUser:async()=>({data:{user:signedIn?user:null}})},
  rpc:async()=>({data:permissions,error:readError}),from:()=>({select(){return this},eq(){return this},returns:async()=>({data:roles,error:readError})})}}
})
const request=body=>new Request('https://gridex.se/api/admin/customer-portal/outbox',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
test('ticket manager retains its console page but cannot replay customer operations or manage CIS',async()=>{
 const ctx=await getAdminContext()
 assert.equal(ctx.isAdmin,false,'a scoped support permission must never become full administration')
 assert.equal((await requireAdminPageAccess({anyOf:['support_tickets.manage']})).userId,user.id)
 assert.equal(hasPermission(ctx,'integrations.write'),false)
 assert.equal(hasPermission(ctx,'support_tickets.manage'),true)
 assert.equal((await replay(request({id:'22222222-2222-4222-8222-222222222222'}))).status,403)
 assert.equal((await cis(request({actionId:'22222222-2222-4222-8222-222222222222',operation:'retry'}))).status,403)
 assert.equal(globalThis.__adminBoundary.privilegedWrites,0)
 await assert.rejects(requireAdminActionAccess({anyOf:['cis.sync.write']}),/Permission denied/)
})
test('explicit global administration remains recognized; inactive or unrelated roles do not grant it',async()=>{
 permissions=[];roles=[{role:'admin',is_active:true}];assert.equal((await getAdminContext()).isAdmin,true)
 permissions=['admin.access'];roles=[];assert.equal((await getAdminContext()).isAdmin,true)
 permissions=[];roles=[{role:'admin',is_active:false},{role:'customer',is_active:true}];assert.equal((await getAdminContext()).isAdmin,false)
})
test('expired login and authority read failures cannot construct privileged operations',async()=>{
 signedIn=false;assert.equal((await replay(request({id:'anything'}))).status,403)
 signedIn=true;readError={message:'authority unavailable'}
 await assert.rejects(getAdminContext(),/authority unavailable/)
 assert.equal(globalThis.__adminBoundary.privilegedWrites,0)
})
