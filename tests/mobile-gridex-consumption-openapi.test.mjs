import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertCustomerPortalOperationRequest} from '../lib/ops/validators/openapi.ts';
const spec=JSON.parse(readFileSync(new URL('../docs/openapi/customer-consumption-v1.json',import.meta.url),'utf8'));
const headers=new Headers({'x-gridex-customer-portal-user-id':'11111111-1111-4111-8111-111111111111','x-gridex-auth-user-id':'11111111-1111-4111-8111-111111111111','x-gridex-customer-number':'own-customer'});
test('real published validator permits base capability read and continues rejecting customer identity query overrides',()=>{
 for(const path of ['/api/v1/customer/consumption/sites','/api/v1/customer/consumption/metering-values']){
  const query = path.endsWith('/metering-values') ? '?facility_id=FAC-A&from=2026-11-01T00:00:00Z&to=2026-11-08T00:00:00Z' : '';
  assertCustomerPortalOperationRequest(path+query,'get',undefined,headers);
  assert.throws(()=>assertCustomerPortalOperationRequest(`${path}?customer_id=foreign`,'get',undefined,headers),error=>error.code==='openapi_query_parameter_unknown');
 }
});
test('actual query validator exposes current pagination/filter capability without bypassing the approved schema',()=>{
 for(const [path,query]of [['/api/v1/customer/consumption/sites','limit=100&cursor=next'],['/api/v1/customer/consumption/metering-values','limit=100&from=2026-11-01T00:00:00.000Z&to=2026-11-08T00:00:00.000Z&facility_id=735999123456789012']]){
  const parameters=spec.paths[path].get.parameters??[];const hasQuery=parameters.map(p=>p.$ref?spec.components.parameters[p.$ref.split('/').at(-1)]:p).some(p=>p?.in==='query');
  if(!hasQuery)assert.throws(()=>assertCustomerPortalOperationRequest(`${path}?${query}`,'get',undefined,headers),error=>error.code==='openapi_query_parameter_unknown');
  else assertCustomerPortalOperationRequest(`${path}?${query}`,'get',undefined,headers);
 }
});

test('the separate consumption response schema requires complete authority and revision metadata', async()=>{
 const {assertCustomerPortalOperationResponse,hasCustomerPortalOperation}=await import('../lib/ops/validators/openapi.ts');
 const path='/api/v1/customer/consumption/sites';
 assert.equal(hasCustomerPortalOperation(path,'get'),true);
 assert.equal(hasCustomerPortalOperation('/api/v1/customer/sites','get'),true);
 const response={data:{sites:[],metering_points:[],delivery_access:{version:'customer-supply-periods-v1',complete:true,windows:[]}},page:{sites:{has_more:false,next_cursor:null}}};
 assertCustomerPortalOperationResponse(path,'get',200,response);
 assert.throws(()=>assertCustomerPortalOperationResponse(path,'get',200,{...response,data:{sites:[],metering_points:[]}}));
 assert.throws(()=>assertCustomerPortalOperationResponse(path,'get',200,{...response,data:{...response.data,delivery_access:{...response.data.delivery_access,complete:false}}}));
 const row={metering_value_reference:'meter_value',metering_point_reference:'point',period_start:'2026-11-01T00:00:00Z',period_end:'2026-11-01T01:00:00Z',resolution:'PT1H',quantity_kwh:2,quality_status:null,status:'stored',created_at:null,revision_status:'current',direction:'consumption',unit:'kWh'};
 const values={data:[row],page:{has_more:false,next_cursor:null}};
 assertCustomerPortalOperationResponse('/api/v1/customer/consumption/metering-values','get',200,values);
 const missing={...row};delete missing.revision_status;
 assert.throws(()=>assertCustomerPortalOperationResponse('/api/v1/customer/consumption/metering-values','get',200,{...values,data:[missing]}));
 assert.throws(()=>assertCustomerPortalOperationRequest(path+'?cursor=one&cursor=two','get',undefined,headers));
});
