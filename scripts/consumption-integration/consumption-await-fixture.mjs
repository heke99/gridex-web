import {execFileSync} from 'node:child_process';
import {awaitArtifact} from '../mobile-integration/await-artifact.mjs';
const repository=process.env.GITHUB_REPOSITORY,run=process.env.GITHUB_RUN_ID;
const api=path=>JSON.parse(execFileSync('gh',['api',path],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000}));
const deadline=Date.now()+95*60*1000;let errors=0;
while(Date.now()<deadline){
 try{
  const artifacts=api(`repos/${repository}/actions/runs/${run}/artifacts`).artifacts;
  if(artifacts.some(a=>a.name==='ios-encrypted-customer-fixture'&&!a.expired)){await awaitArtifact('ios-encrypted-customer-fixture',process.argv[2]);process.exit(0);}
  const jobs=api(`repos/${repository}/actions/runs/${run}/jobs`).jobs;
  if(jobs.some(j=>j.name==='customer-stack'&&j.status==='completed'))throw Error('BACKEND_TERMINAL');
  errors=0;
 }catch(error){if(error.message==='BACKEND_TERMINAL')throw Error('Paired backend finished before its encrypted fixture was ready');if(++errors>2)throw Error('Paired producer metadata unavailable');}
 await new Promise(r=>setTimeout(r,10000));
}
throw Error('Paired fixture deadline reached');
