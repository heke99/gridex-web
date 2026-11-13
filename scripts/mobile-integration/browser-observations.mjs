const handoffPaths=new Set(['/login/forgot-password','/teckna','/dashboard/contracts','/dashboard/support']);
export function invoicePdfMatcher(reference){
 if(typeof reference!=='string'||!/^document_[A-Za-z0-9_-]{32}$/.test(reference))throw Error('Invalid synthetic invoice reference');
 return row=>row?.reference===reference&&row.platform==='ios'&&row.authorizationPresent===false;
}
export function handoffMatcher(path){
 if(!handoffPaths.has(path))throw Error('Invalid synthetic handoff');
 return row=>row?.path===path&&row.platform==='ios'&&row.credentialPresent===false;
}
/** External readers can cold-start slowly; only observed requests satisfy this wait. */
export async function awaitBrowserObservation(readRows,matches,{timeoutMs=60000,afterCount=0,now=Date.now,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 if(!Number.isInteger(afterCount)||afterCount<0)throw Error('Invalid observation baseline');
 const deadline=now()+timeoutMs;
 while(now()<deadline){
  if(readRows().filter(matches).length>afterCount)return true;
  await sleep(Math.min(500,Math.max(0,deadline-now())));
 }
 return readRows().filter(matches).length>afterCount;
}
