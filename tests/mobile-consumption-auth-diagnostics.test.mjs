import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarizeGrant,summarizeAuthResponse} from '../scripts/consumption-integration/consumption-auth-diagnostics.mjs';
const customers=[{label:'A',login:{email:'synthetic-a@invalid.example',password:'private-password-a'}},{label:'B',login:{email:'synthetic-b@invalid.example',password:'private-password-b'}}];
test('Auth diagnostics distinguish intended identities and wrong input without exporting credentials',()=>{
 for(const customer of customers){
  assert.deepEqual(summarizeGrant(JSON.stringify(customer.login),customers),{customer:customer.label,credentialsMatch:true});
  const wrong=summarizeGrant(JSON.stringify({...customer.login,password:'unexpected-secret'}),customers);assert.deepEqual(wrong,{customer:customer.label,credentialsMatch:false});
  for(const secret of [customer.login.email,customer.login.password,'unexpected-secret'])assert.ok(!JSON.stringify(wrong).includes(secret));
 }
 for(const raw of ['null','false','5','[]'])assert.deepEqual(summarizeGrant(raw,customers),{customer:'unknown',credentialsMatch:false});
 assert.deepEqual(summarizeGrant('{bad',customers),{customer:'unknown',credentialsMatch:false});
 assert.deepEqual(summarizeGrant('{"email":"foreign@invalid.example","password":"external-secret"}',customers),{customer:'unknown',credentialsMatch:false});
});
test('Only fixed Auth error enums can enter diagnostics',()=>{
 assert.equal(summarizeAuthResponse('{"error_code":"invalid_credentials","message":"sensitive"}'),'invalid_credentials');
 assert.equal(summarizeAuthResponse('{"code":"private-value","access_token":"private-token"}'),'other');
 assert.equal(summarizeAuthResponse('not JSON private-value'),'unparseable');
 for(const raw of ['null','false','5','[]'])assert.equal(summarizeAuthResponse(raw),'unparseable');
});
