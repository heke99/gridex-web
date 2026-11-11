import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const operations=new Set(['password','refresh','user','logout','other']);
const outcomes=new Set(['response','transport-error','upstream-timeout','client-disconnected']);
const platforms=new Set(['android','ios','other']);
const identities=new Set(['A','B','none','not-applicable']);
export function syntheticCredentialIdentity(body,customers){
 try{
  const value=JSON.parse(body);
  if(typeof value?.email!=='string'||typeof value?.password!=='string')return 'none';
  const match=customers.find(u=>['A','B'].includes(u.label)&&u.login?.email===value.email&&u.login?.password===value.password);
  return match?.label??'none';
 }catch{return 'none';}
}
function safeObservation(row){
 if(!row||!platforms.has(row.platform)||!operations.has(row.operation)||!outcomes.has(row.outcome)||!identities.has(row.identity))return null;
 return {platform:row.platform,operation:row.operation,identity:row.identity,status:Number.isInteger(row.status)&&row.status>=100&&row.status<=599?row.status:0,outcome:row.outcome,durationMs:Number.isFinite(row.durationMs)?Math.max(0,Math.round(row.durationMs)):0,timestamp:Number.isSafeInteger(row.timestamp)&&row.timestamp>=0?row.timestamp:Date.now()};
}
export function recordAuthObservation(row,directory){
 const safe=safeObservation(row);if(!safe)return;
 const file=join(directory,'mobile-auth-requests.json'),previous=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):[];
 writeFileSync(file,JSON.stringify([...previous.map(safeObservation).filter(Boolean),safe]),{mode:0o600});
}
/** Observe only the isolated Auth proxy; body text is never retained or exported. */
export function observeAuthRequest(incoming,outgoing,{platform,operation,customers,directory}){
 const started=Date.now();let recorded=false,identity=operation==='password'?'none':'not-applicable',chunks=[],bytes=0;
 if(operation==='password'){
  incoming.on('data',chunk=>{if(chunks!==null){bytes+=chunk.length;if(bytes<=8192)chunks.push(Buffer.from(chunk));else chunks=null;}});
  incoming.once('end',()=>{identity=chunks===null?'none':syntheticCredentialIdentity(Buffer.concat(chunks).toString('utf8'),customers);chunks=[];});
 }
 const finish=(status,outcome)=>{
  if(recorded)return;recorded=true;chunks=[];
  recordAuthObservation({platform,operation,identity,status,outcome,durationMs:Date.now()-started},directory);
 };
 outgoing.once('close',()=>{if(!outgoing.writableEnded)finish(0,'client-disconnected');});
 return finish;
}
