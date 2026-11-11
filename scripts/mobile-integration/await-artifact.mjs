import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
const [name,directory]=process.argv.slice(2);
if(!/^[a-z0-9-]+$/.test(name)||!directory||!/^\d+$/.test(process.env.GITHUB_RUN_ID??''))throw Error('Invalid artifact request');
mkdirSync(directory,{recursive:true,mode:0o700});
const deadline=Date.now()+25*60*1000;
let found=false;
while(Date.now()<deadline){
 const data=JSON.parse(execFileSync('gh',['api',`repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts`],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
 if(name==='ios-encrypted-customer-fixture'&&data.artifacts.some(a=>a.name==='mobile-backend-setup-failed'))throw Error('Shared disposable backend failed; inspect its sanitized evidence');
 if(data.artifacts.some(a=>a.name===name&&!a.expired)){found=true;break;}
 await new Promise(resolve=>setTimeout(resolve,5000));
}
if(!found)throw Error('Timed out waiting for sibling-job artifact: '+name);
execFileSync('gh',['run','download',process.env.GITHUB_RUN_ID,'--repo',process.env.GITHUB_REPOSITORY,'--name',name,'--dir',directory],{stdio:['ignore','ignore','ignore']});
console.log('Received sibling-job artifact '+name);
