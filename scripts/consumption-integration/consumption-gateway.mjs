// Test-only gateway: no OPS, REST, signup or Auth-admin exposure.
import {createServer,request} from 'node:http';
import {readFileSync,writeFileSync} from 'node:fs';
import {timingSafeEqual} from 'node:crypto';
import {summarizeGrant,summarizeAuthResponse} from './consumption-auth-diagnostics.mjs';
import {oracle,bounds} from './consumption-fixtures.mjs';
const root=process.env.RUNNER_TEMP,fixture=JSON.parse(readFileSync(root+'/mobile-fixtures/customers.json','utf8'));
const key=Buffer.from(process.env.GRIDEX_QUALIFICATION_CONTROL_KEY??'');if(key.length!==64)throw Error('Missing bounded test control key');
const observations=[],authObservations=[];let phase='unassigned';
const platform=agent=>/Android|okhttp/i.test(agent??'')?'android':/iPhone|iPad|CFNetwork|Darwin/.test(agent??'')?'ios':'other';
const auth=new Map([['/auth/v1/token',['POST']],['/auth/v1/user',['GET']],['/auth/v1/logout',['POST']]]);
function owner(header){try{const token=String(header??'').replace(/^Bearer /,'');const id=JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub;return fixture.customers.find(u=>u.userId===id);}catch{return null;}}
function json(response,status,body){response.writeHead(status,{'content-type':'application/json','cache-control':'private, no-store'});response.end(JSON.stringify(body));}
createServer(async(incoming,outgoing)=>{
 const url=new URL(incoming.url,'http://127.0.0.1');
 if(url.pathname==='/qualification-health'&&incoming.method==='GET'){outgoing.end('synthetic-consumption-stack');return;}
 if(url.pathname==='/qualification-consumption'&&incoming.method==='POST'){
  const supplied=Buffer.from(String(incoming.headers['x-qualification-control']??''));if(supplied.length!==key.length||!timingSafeEqual(supplied,key)){json(outgoing,403,{error:'denied'});return;}
  try{
   let raw='';for await(const chunk of incoming){raw+=chunk;if(raw.length>2048)throw Error('Input limit');}const input=JSON.parse(raw);
   if(input.action==='auth-snapshot'){if(!/^ios:[AB]:login$/.test(input.phase))throw Error('Invalid Auth phase');json(outgoing,200,{passed:true,count:authObservations.length});return;}
   if(input.action==='auth-observed'){
    if(!/^ios:[AB]:login$/.test(input.phase)||!Number.isInteger(input.previous)||input.previous<0)throw Error('Invalid Auth baseline');
    const deadline=Date.now()+25000;let found;
    do{found=authObservations.slice(input.previous).find(r=>r.platform==='ios');if(found||Date.now()>=deadline)break;await new Promise(r=>setTimeout(r,100));}while(true);
    const diagnostic=found??{customer:'unknown',credentialsMatch:false,status:null,outcome:'not-observed',errorCode:'none'};
    json(outgoing,200,{passed:true,successful:!!found&&found.customer===input.phase.split(':')[1]&&found.credentialsMatch&&found.status===200&&found.outcome==='complete',diagnostic});return;
   }
   if(input.action==='expectations'){json(outgoing,200,{passed:true,customers:fixture.customers.map(u=>({label:u.label,secondaryTitle:u.consumption.secondaryTitle,expected:u.consumption.expected}))});return;}
   if(input.action==='snapshot'){if(!/^(android|ios):[AB]:(primary|secondary):(7|30)$/.test(input.phase))throw Error('Invalid phase');phase=input.phase;json(outgoing,200,{passed:true,count:observations.length});return;}
   if(['observed','assert'].includes(input.action)){
    if(!Number.isInteger(input.previous)||input.previous<0||input.phase!==phase)throw Error('Missing baseline');
    const deadline=Date.now()+(input.action==='observed'?25000:0);let found;
    do{found=observations.slice(input.previous).find(r=>r.phase===input.phase&&r.correct);if(found||Date.now()>=deadline)break;await new Promise(r=>setTimeout(r,100));}while(true);
    if(!found)throw Error('No fresh correct consumption response');
    json(outgoing,200,{passed:true,count:observations.length,display:found.expectedDisplay,dateLabel:found.dateLabel});return;
   }
   throw Error('Unknown action');
  }catch{json(outgoing,400,{error:'bounded-control-failed'});return;}
 }
 let port;
 if(auth.get(url.pathname)?.includes(incoming.method))port=54321;
 else if(incoming.method==='GET'&&(url.pathname.startsWith('/api/mobile/customer/')||url.pathname==='/api/elpris/day'))port=3100;
 else{json(outgoing,404,{error:'not-found'});return;}
 const headers={...incoming.headers,host:'127.0.0.1:'+port};delete headers['cf-connecting-ip'];delete headers['x-forwarded-for'];
 const receivedAt=Date.now(),currentPhase=phase,who=owner(incoming.headers.authorization),clientPlatform=platform(incoming.headers['user-agent']);
 const authGrant=url.pathname==='/auth/v1/token'&&url.searchParams.get('grant_type')==='password';
 let grantRaw='',grantSize=0,authStatus=null,authRecorded=false;
 if(authGrant)incoming.on('data',chunk=>{grantSize+=chunk.length;if(grantSize<=16384)grantRaw+=chunk.toString('utf8');});
 const recordAuth=(outcome,errorCode='none')=>{
  if(!authGrant||authRecorded)return;authRecorded=true;
  authObservations.push({...summarizeGrant(grantSize<=16384?grantRaw:'',fixture.customers),platform:clientPlatform,status:authStatus,outcome,errorCode});
  writeFileSync(root+'/consumption-auth-observations.json',JSON.stringify({opsCommit:process.env.GRIDEX_OPS_COMMIT,webCommit:process.env.GRIDEX_WEB_COMMIT,observations:authObservations},null,2));
 };
 const upstream=request({hostname:'127.0.0.1',port,path:incoming.url,method:incoming.method,headers,timeout:60000},response=>{
  if(authGrant){authStatus=response.statusCode;let authResponse='',size=0;response.on('data',chunk=>{size+=chunk.length;if(size<=65536)authResponse+=chunk.toString('utf8');});response.on('end',()=>recordAuth('complete',authStatus===200?'none':summarizeAuthResponse(size<=65536?authResponse:'')));}
  const buffers=[];let length=0;
  if(url.pathname==='/api/mobile/customer/consumption'){
   response.on('data',chunk=>{length+=chunk.length;if(length<=8*1024*1024)buffers.push(chunk);});
   response.on('end',()=>{
    let correct=false,actualCount=null,expectedCount=null,expectedDisplay=null,dateLabel=null;
    try{
     const data=JSON.parse(Buffer.concat(buffers).toString('utf8')).data.consumption;
     const kind=who&&(['primary','secondary'].find(k=>who.consumption[k+'Reference']===url.searchParams.get('facility')));
     if(length>8*1024*1024||!kind||response.statusCode!==200)throw Error('Unexpected response');
     const expected=oracle(fixture,who,who.consumption[kind],url.searchParams.get('from'),url.searchParams.get('to'));
     actualCount=data.items.length;expectedCount=expected.count;
     const selectedDays=Number(currentPhase.split(':')[3]),ranges=[bounds(selectedDays,new Date(receivedAt)),bounds(selectedDays,new Date(receivedAt-60000))];
     const selected=ranges.some(range=>url.searchParams.get('from')===range.from&&url.searchParams.get('to')===range.to);
     expectedDisplay=expected.totalKwh.toLocaleString('sv-SE',{maximumFractionDigits:2})+' kWh i hämtade mätvärden';
     const date=value=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
     dateLabel=date(url.searchParams.get('from'))+' – '+date(url.searchParams.get('to'));
     correct=selected&&currentPhase.startsWith(clientPlatform+':'+who.label+':'+kind+':')&&data.complete===true&&data.totalKwh===expected.totalKwh&&JSON.stringify(data.items.map(r=>r.reference).sort())===JSON.stringify(expected.references)&&response.headers['cache-control']==='private, no-store';
    }catch{correct=false;}
    observations.push({phase:currentPhase,platform:clientPlatform,customer:who?.label??'unlinked',status:response.statusCode,actualCount,expectedCount,expectedDisplay,dateLabel,correct});writeFileSync(root+'/consumption-native-observations.json',JSON.stringify({opsCommit:process.env.GRIDEX_OPS_COMMIT,webCommit:process.env.GRIDEX_WEB_COMMIT,observations},null,2));
   });
  }
  outgoing.writeHead(response.statusCode??502,response.headers);response.pipe(outgoing);
 });
 upstream.on('timeout',()=>{recordAuth('upstream-timeout');upstream.destroy();});upstream.on('error',()=>{recordAuth('upstream-error');if(!outgoing.headersSent)json(outgoing,503,{error:'upstream-unavailable'});else outgoing.destroy();});outgoing.on('close',()=>{recordAuth('client-closed');upstream.destroy();});incoming.pipe(upstream);
}).listen(Number(process.env.GRIDEX_CONSUMPTION_GATEWAY_PORT??3445),'127.0.0.1',function(){process.send?.({port:this.address().port});});
