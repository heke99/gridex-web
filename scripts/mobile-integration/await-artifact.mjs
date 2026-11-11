import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readdirSync,renameSync,rmSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export async function awaitArtifact(name,directory,{
 runId=process.env.GITHUB_RUN_ID,repository=process.env.GITHUB_REPOSITORY,
 execute=execFileSync,now=Date.now,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
}={}){
 if(!/^[a-z0-9-]+$/.test(name)||!directory||!/^\d+$/.test(runId??'')||!/^[-\w.]+\/[-\w.]+$/.test(repository??''))throw Error('Invalid artifact request');
 mkdirSync(directory,{recursive:true,mode:0o700});
 if(readdirSync(directory).length)throw Error('Artifact destination must be empty');
 const timeoutMinutes=name==='ios-customer-terminal'?60:name==='android-customer-terminal'?40:25;
 const deadline=now()+timeoutMinutes*60*1000;
 let failures=0,found=false;
 const pause=()=>sleep(Math.min(5000,Math.max(0,deadline-now())));
 while(now()<deadline){
  let data;
  try{
   data=JSON.parse(execute('gh',['api',`repos/${repository}/actions/runs/${runId}/artifacts`],{encoding:'utf8',timeout:Math.max(1,Math.min(20000,deadline-now())),stdio:['ignore','pipe','pipe']}));
   if(!Array.isArray(data.artifacts))throw Error('Invalid artifact listing');
   failures=0;
  }catch{
   if(++failures>=6)throw Error('Sibling artifact listing unavailable after bounded retries');
   await pause();continue;
  }
  if(name==='ios-encrypted-customer-fixture'&&data.artifacts.some(a=>a.name==='mobile-backend-setup-failed'))throw Error('Shared disposable backend failed; inspect its sanitized evidence');
  if(data.artifacts.some(a=>a.name===name&&!a.expired)){found=true;break;}
  await pause();
 }
 if(!found)throw Error('Timed out waiting for sibling-job artifact: '+name);
 failures=0;
 while(now()<deadline){
  const staging=mkdtempSync(directory+'.download-');
  try{
   execute('gh',['run','download',runId,'--repo',repository,'--name',name,'--dir',staging],{timeout:Math.max(1,Math.min(60000,deadline-now())),stdio:['ignore','pipe','pipe']});
  }catch{
   rmSync(staging,{recursive:true,force:true});
   if(++failures>=6)throw Error('Sibling artifact download unavailable after bounded retries');
   await pause();continue;
  }
  if(!readdirSync(staging).length){rmSync(staging,{recursive:true,force:true});throw Error('Downloaded artifact is empty');}
  // Publish only a complete download; never reuse a failed attempt's partial files.
  renameSync(staging,directory);
  console.log('Received sibling-job artifact '+name);
  return;
 }
 throw Error('Timed out downloading sibling-job artifact: '+name);
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const [name,directory]=process.argv.slice(2);
 await awaitArtifact(name,directory);
}
