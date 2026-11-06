import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {createCustomerBackend} from './handler.mjs';
/** Synthetic, read-only example. It is not a production auth/storage implementation. */
export function createDemoBackend(){return createCustomerBackend({
 authenticate:async token=>token==='demo-customer-one-token'?{subject:'demo-one',tenantId:'demo-tenant',customerReference:'demo-one'}:token==='demo-customer-two-token'?{subject:'demo-two',tenantId:'demo-tenant',customerReference:'demo-two'}:null,
 provider:{read:async(binding,{kind})=>({items:kind==='profile'?[{reference:binding.customerReference,name:`Demo ${binding.subject}`,email:null,phone:null,customerNumber:binding.customerReference,customerType:'demo',status:'demo'}]:kind==='contracts'?[{reference:`contract-${binding.customerReference}`,name:'Exempelavtal – syntetiska uppgifter',status:'demo',startDate:null}]:[]})}
});}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.env.NODE_ENV==='production')throw new Error('Synthetic demo cannot run as production');
 const handler=createDemoBackend();
 const server=createServer(async(req,res)=>{try{if(req.method!=='GET'){res.writeHead(405);res.end();return;}const response=await handler(new Request(`http://127.0.0.1${req.url}`,{headers:req.headers}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());}catch{res.writeHead(500);res.end();}});
 server.listen(4310,'127.0.0.1',()=>console.log('Synthetic read-only demo: http://127.0.0.1:4310/customer/v1/profile'));
}
