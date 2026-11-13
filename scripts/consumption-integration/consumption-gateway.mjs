// Test-only gateway: no OPS, REST, signup or Auth-admin exposure.
import {createServer,request} from 'node:http';
import {readFileSync,writeFileSync} from 'node:fs';
import {timingSafeEqual} from 'node:crypto';
import {oracle,bounds} from './consumption-fixtures.mjs';
const root=process.env.RUNNER_TEMP,fixture=JSON.parse(readFileSync(root+'/mobile-fixtures/customers.json','utf8'));
const key=Buffer.from(process.env.GRIDEX_QUALIFICATION_CONTROL_KEY??'');if(key.length!==64)throw Error('Missing bounded test control key');
const observations=[];let phase='unassigned';
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
 const upstream=request({hostname:'127.0.0.1',port,path:incoming.url,method:incoming.method,headers,timeout:60000},response=>{
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
 upstream.on('timeout',()=>upstream.destroy());upstream.on('error',()=>{if(!outgoing.headersSent)json(outgoing,503,{error:'upstream-unavailable'});else outgoing.destroy();});outgoing.on('close',()=>upstream.destroy());incoming.pipe(upstream);
}).listen(Number(process.env.GRIDEX_CONSUMPTION_GATEWAY_PORT??3445),'127.0.0.1',function(){process.send?.({port:this.address().port});});
