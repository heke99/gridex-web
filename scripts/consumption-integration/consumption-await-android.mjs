import {execFileSync} from 'node:child_process';
import {awaitArtifact} from '../mobile-integration/await-artifact.mjs';
const repository=process.env.GITHUB_REPOSITORY,run=process.env.GITHUB_RUN_ID;
const api=path=>JSON.parse(execFileSync('gh',['api',path],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000}));
const deadline=Date.now()+60*60*1000;let errors=0,completedAt=null;
while(Date.now()<deadline){
 try{
  const artifacts=api(`repos/${repository}/actions/runs/${run}/artifacts`).artifacts;
  if(artifacts.some(a=>a.name==='consumption-android-terminal'&&!a.expired)){await awaitArtifact('consumption-android-terminal',process.argv[2]);process.exit(0);}
  const producer=api(`repos/${repository}/actions/runs/${run}/jobs`).jobs.find(j=>j.name==='customer-stack');
  if(producer?.status==='completed'){completedAt??=Date.now();if(Date.now()-completedAt>60000)throw Error('PRODUCER_TERMINAL');}
  errors=0;
 }catch(error){if(error.message==='PRODUCER_TERMINAL')throw Error('Android producer ended without its terminal proof');if(++errors>2)throw Error('Android producer metadata unavailable');}
 await new Promise(r=>setTimeout(r,10000));
}
throw Error('Android consumption producer did not finish within its explicit 60-minute deadline');
