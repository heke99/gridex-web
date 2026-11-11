// Isolated synthetic test stack only. Never expose REST, Auth admin, signup or OPS.
import {createServer,request} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {timingSafeEqual} from 'node:crypto';
import {recordControlObservation} from './control-observations.mjs';
import {observeAuthRequest} from './auth-observations.mjs';
const auth=new Map([['/auth/v1/token',['POST']],['/auth/v1/user',['GET']],['/auth/v1/logout',['POST']]]);
const platform=agent=>/Android|okhttp/i.test(agent??'')?'android':/iPhone|iPad|CFNetwork|Darwin/.test(agent??'')?'ios':'other';
let disconnected=false,marketDisconnected=false,disabledDocumentCount=null;
const server=createServer(async(incoming,outgoing)=>{
 const path=new URL(incoming.url,'http://127.0.0.1').pathname;
 if(['/login/forgot-password','/teckna','/dashboard/contracts','/dashboard/support'].includes(path)&&incoming.method==='GET'){
  const report=process.env.RUNNER_TEMP+'/mobile-handoff-requests.json',rows=existsSync(report)?JSON.parse(readFileSync(report,'utf8')):[];
  const invalid=Boolean(incoming.headers.authorization)||new URL(incoming.url,'http://127.0.0.1').search!=='';
  rows.push({path,platform:platform(incoming.headers['user-agent']),credentialPresent:invalid});writeFileSync(report,JSON.stringify(rows));
  if(invalid){outgoing.writeHead(400).end();return;}
  outgoing.writeHead(303,{location:'https://gridex.se'+path,'cache-control':'no-store'}).end();return;
 }
 if(path==='/qualification-control'&&incoming.method==='POST'){
  const expected=Buffer.from(process.env.GRIDEX_QUALIFICATION_CONTROL_KEY??''),supplied=Buffer.from(String(incoming.headers['x-qualification-control']??''));
  if(!expected.length||expected.length!==supplied.length||!timingSafeEqual(expected,supplied)){outgoing.writeHead(404).end();return;}
  let controlAction;
  try{
   let data='';for await(const part of incoming){data+=part;if(data.length>1024)throw Error('Too large');}
   const controlOrigin=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);if(controlOrigin.hostname!=='127.0.0.1'||controlOrigin.port!=='54321')throw Error('Controls require disposable loopback Auth');
   const input=JSON.parse(data);controlAction=input.action;recordControlObservation(controlAction,'started');const fixture=JSON.parse(readFileSync(process.env.RUNNER_TEMP+'/mobile-fixtures/customers.json','utf8'));
   async function count(){const query=new URLSearchParams({select:'id',api_client_id:'eq.'+fixture.clientId,status_code:'eq.200'});const r=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/integration_api_requests?'+query,{headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY},signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Observation unavailable');return (await r.json()).length;}
   if(input.action==='disconnect-market')marketDisconnected=true;
   else if(input.action==='reconnect-market')marketDisconnected=false;
   else if(['disable-document-b','restore-document-b'].includes(input.action)){
    const user=fixture.customers.find(u=>u.label==='B');
    const report=process.env.RUNNER_TEMP+'/mobile-document-requests.json';const rows=existsSync(report)?JSON.parse(readFileSync(report,'utf8')):[];const documentCount=rows.filter(r=>r.reference===user.extra.document&&r.platform==='ios').length;
    if(input.action==='disable-document-b')disabledDocumentCount=documentCount;else if(disabledDocumentCount===null||documentCount!==disabledDocumentCount)throw Error('Unexpected browser request for stale link');
    const query=new URLSearchParams({company_id:'eq.'+fixture.companyId,title:'eq.'+user.extra.documentTitle});
    const url=input.action==='disable-document-b'?null:process.env.GRIDEX_DEVICE_PUBLIC_ORIGIN+'/qualification-document/'+user.extra.document;
    const r=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/customer_documents?'+query,{method:'PATCH',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json',prefer:'return=representation'},body:JSON.stringify({public_url:url}),signal:AbortSignal.timeout(5000)});
    if(!r.ok||(await r.json()).length!==1)throw Error('Synthetic document scope unavailable');
   }else if(input.action==='disconnect')disconnected=true;
   else if(input.action==='reconnect')disconnected=false;
   else if(input.action==='wait-expiry-tick')await new Promise(resolve=>setTimeout(resolve,5000));
   else if(input.action==='revoke-b'){
    const user=fixture.customers.find(u=>u.label==='B');
    const r=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,'content-type':'application/json'},body:JSON.stringify(user.login),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Synthetic session unavailable');const session=await r.json();
    const revoked=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/logout?scope=global',{method:'POST',headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,authorization:'Bearer '+session.access_token},signal:AbortSignal.timeout(10000)});if(!revoked.ok)throw Error('Synthetic revocation failed');
   }else if(/^assert-invoice-pdf-[ab]$/.test(input.action)){
    const user=fixture.customers.find(u=>u.label===input.action.slice(-1).toUpperCase());const report=process.env.RUNNER_TEMP+'/mobile-document-requests.json';let observed=false;
    for(let n=0;n<40;n++){const rows=existsSync(report)?JSON.parse(readFileSync(report,'utf8')):[];if(rows.some(r=>r.reference===user.extra.invoiceDocument&&r.platform==='ios'&&!r.authorizationPresent)){observed=true;break;}await new Promise(resolve=>setTimeout(resolve,500));}
    if(!observed)throw Error('No actual invoice PDF browser request');
   }else if(input.action.startsWith('assert-handoff-')){
    const paths={recovery:'/login/forgot-password',signup:'/teckna',contracts:'/dashboard/contracts',support:'/dashboard/support'};
    const expectedPath=paths[input.action.slice('assert-handoff-'.length)];if(!expectedPath)throw Error('Unknown handoff');
    let found=false;const report=process.env.RUNNER_TEMP+'/mobile-handoff-requests.json';
    for(let n=0;n<20;n++){const rows=existsSync(report)?JSON.parse(readFileSync(report,'utf8')):[];if(rows.some(r=>r.path===expectedPath&&r.platform==='ios'&&!r.credentialPresent)){found=true;break;}await new Promise(resolve=>setTimeout(resolve,500));}
    if(!found)throw Error('Native external handoff not observed');
   }else if(!['snapshot','assert-fresh'].includes(input.action))throw Error('Unknown control');
   let observed=await count();
   if(input.action==='assert-fresh'){
    if(!Number.isInteger(input.previous)||input.previous<0||input.previous>100000)throw Error('Invalid previous count');
    for(let n=0;n<20&&observed<=input.previous;n++){await new Promise(resolve=>setTimeout(resolve,500));observed=await count();}
    if(observed<=input.previous)throw Error('No fresh OPS read observed');
   }
   recordControlObservation(controlAction,'passed');
   outgoing.writeHead(200,{'content-type':'application/json','cache-control':'no-store'}).end(JSON.stringify({passed:true,count:observed}));
  }catch{try{recordControlObservation(controlAction,'failed');}catch{}outgoing.writeHead(503,{'content-type':'application/json','cache-control':'no-store'}).end('{"passed":false}');}
  return;
 }
 if(path==='/qualification-health'&&incoming.method==='GET'){outgoing.writeHead(200,{'content-type':'text/plain','cache-control':'no-store'}).end('synthetic-test-stack');return;}
 if(path==='/qualification-observations'&&incoming.method==='GET'){
  const file=process.env.RUNNER_TEMP+'/mobile-document-requests.json';outgoing.writeHead(200,{'content-type':'application/json','cache-control':'no-store'}).end(JSON.stringify({documents:existsSync(file)?JSON.parse(readFileSync(file,'utf8')):[]}));return;
 }
 if(/^\/qualification-document\/document_[A-Za-z0-9_-]{32}$/.test(path)&&incoming.method==='GET'){
  const reference=path.split('/').at(-1);
  const fixture=JSON.parse(readFileSync(process.env.RUNNER_TEMP+'/mobile-fixtures/customers.json','utf8'));
  const owner=fixture.customers.find(u=>u.extra.document===reference||u.extra.invoiceDocument===reference);
  if(!owner){outgoing.writeHead(404).end();return;}
  const report=process.env.RUNNER_TEMP+'/mobile-document-requests.json';const rows=existsSync(report)?JSON.parse(readFileSync(report,'utf8')):[];
  const agent=incoming.headers['user-agent']??'';
  rows.push({reference,authorizationPresent:Boolean(incoming.headers.authorization),platform:platform(agent),timestamp:Date.now()});writeFileSync(report,JSON.stringify(rows));
  if(incoming.headers.authorization){outgoing.writeHead(400).end();return;}
  const label='Synthetic Gridex document '+owner.label;
  const stream=`BT /F1 18 Tf 30 760 Td (${label}) Tj ET`;
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let pdf='%PDF-1.4\n',offsets=[0];for(const [index,object]of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${index+1} 0 obj\n${object}\nendobj\n`;}
  const start=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  outgoing.writeHead(200,{'content-type':'application/pdf','cache-control':'private, no-store','content-disposition':`inline; filename="synthetic-gridex-${reference}.pdf"`}).end(pdf);return;
 }
 let port;
 if(disconnected&&(path.startsWith('/api/mobile/customer/')||path.startsWith('/auth/v1/'))){incoming.socket.destroy();return;}
 if(auth.get(path)?.includes(incoming.method))port=54321;
 else if(path.startsWith('/api/mobile/customer/')&&['GET','POST'].includes(incoming.method))port=3100;
 else if(path==='/api/elpris/day'&&incoming.method==='GET'){
  const url=new URL(incoming.url,'http://127.0.0.1');
  const report=process.env.RUNNER_TEMP+'/mobile-market-requests.json',rows=existsSync(report)?JSON.parse(readFileSync(report,'utf8')):[];
  const invalid=Boolean(incoming.headers.authorization)||[...url.searchParams.keys()].some(k=>!['area','date'].includes(k));
  rows.push({area:url.searchParams.get('area'),date:url.searchParams.get('date'),authorizationPresent:Boolean(incoming.headers.authorization),platform:platform(incoming.headers['user-agent'])});writeFileSync(report,JSON.stringify(rows));
  if(invalid){outgoing.writeHead(400).end();return;}
  if(marketDisconnected){outgoing.writeHead(503,{'content-type':'application/json','cache-control':'no-store'}).end('{"error":"synthetic market outage"}');return;}
  // Canonical public market data only; no incoming Auth/cookies/keys forwarded.
  const upstream=httpsRequest('https://gridex.se'+incoming.url,{headers:{accept:'application/json'},timeout:20000},response=>{outgoing.writeHead(response.statusCode??502,response.headers);response.pipe(outgoing);});
  upstream.on('timeout',()=>upstream.destroy());upstream.on('error',()=>{if(!outgoing.headersSent)outgoing.writeHead(503);outgoing.end();});upstream.end();return;
 }else{outgoing.writeHead(404,{'cache-control':'no-store'}).end();return;}
 const headers={...incoming.headers,host:`127.0.0.1:${port}`};delete headers['cf-connecting-ip'];delete headers['x-forwarded-for'];
 let authFinished=()=>{};
 if(port===54321){
  const grant=new URL(incoming.url,'http://127.0.0.1').searchParams.get('grant_type');
  const operation=path==='/auth/v1/token'?(grant==='password'?'password':grant==='refresh_token'?'refresh':'other'):path==='/auth/v1/user'?'user':'logout';
  const fixture=JSON.parse(readFileSync(process.env.RUNNER_TEMP+'/mobile-fixtures/customers.json','utf8'));
  authFinished=observeAuthRequest(incoming,outgoing,{platform:platform(incoming.headers['user-agent']),operation,customers:fixture.customers,directory:process.env.RUNNER_TEMP});
 }
 const upstream=request({hostname:'127.0.0.1',port,path:incoming.url,method:incoming.method,headers,timeout:60000},response=>{outgoing.writeHead(response.statusCode??502,response.headers);response.once('end',()=>authFinished(response.statusCode??502,'response'));response.once('aborted',()=>{authFinished(0,'transport-error');outgoing.destroy();});response.pipe(outgoing);});
 upstream.on('timeout',()=>{authFinished(0,'upstream-timeout');upstream.destroy();});upstream.on('error',()=>{authFinished(0,'transport-error');if(!outgoing.headersSent)outgoing.writeHead(503);outgoing.end();});outgoing.on('close',()=>upstream.destroy());incoming.pipe(upstream);
});
server.listen(Number(process.env.GRIDEX_QUALIFICATION_GATEWAY_PORT??3445),'127.0.0.1',()=>{if(process.send)process.send({port:server.address().port});});
