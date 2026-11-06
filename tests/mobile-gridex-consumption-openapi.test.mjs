import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertCustomerPortalOperationRequest} from '../lib/ops/validators/openapi.ts';
const spec=JSON.parse(readFileSync(new URL('../docs/openapi/customer-portal-v1.json',import.meta.url),'utf8'));
const headers=new Headers({'x-gridex-customer-portal-user-id':'11111111-1111-4111-8111-111111111111','x-gridex-auth-user-id':'11111111-1111-4111-8111-111111111111','x-gridex-customer-number':'own-customer'});
test('real published validator permits base capability read and continues rejecting customer identity query overrides',()=>{
 for(const path of ['/api/v1/customer/sites','/api/v1/customer/metering-values']){
  assertCustomerPortalOperationRequest(path,'get',undefined,headers);
  assert.throws(()=>assertCustomerPortalOperationRequest(`${path}?customer_id=foreign`,'get',undefined,headers),error=>error.code==='openapi_query_parameter_unknown');
 }
});
test('actual query validator exposes current pagination/filter capability without bypassing the approved schema',()=>{
 for(const [path,query]of [['/api/v1/customer/sites','limit=100&cursor=next'],['/api/v1/customer/metering-values','limit=100&from=2026-11-01T00:00:00.000Z&to=2026-11-08T00:00:00.000Z&facility_id=735999123456789012']]){
  const parameters=spec.paths[path].get.parameters??[];const hasQuery=parameters.map(p=>p.$ref?spec.components.parameters[p.$ref.split('/').at(-1)]:p).some(p=>p?.in==='query');
  if(!hasQuery)assert.throws(()=>assertCustomerPortalOperationRequest(`${path}?${query}`,'get',undefined,headers),error=>error.code==='openapi_query_parameter_unknown');
  else assertCustomerPortalOperationRequest(`${path}?${query}`,'get',undefined,headers);
 }
});
