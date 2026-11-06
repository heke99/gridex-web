import {pathToFileURL} from 'node:url';
/** Guard readiness only. Never claims a real authenticated customer was tested. */
export async function checkMobileReadiness(origin,fetcher=fetch){
 const base=new URL(origin);
 if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash||base.pathname!=='/')throw new Error('HTTPS origin required');
 const checks=[];
 for(const [suffix,expected]of [['contracts',401],['contracts?customerId=foreign',400],['profile',401]]){
  try{const res=await fetcher(new URL(`/api/mobile/customer/${suffix}`,base),{redirect:'manual',signal:AbortSignal.timeout(15000)});
   checks.push({endpoint:suffix.split('?')[0],scenario:expected===400?'identity-override-rejected':'login-required',status:res.status,passed:res.status===expected&&res.headers.get('cache-control')?.includes('no-store')===true});
  }catch{checks.push({endpoint:suffix.split('?')[0],scenario:'unreachable',passed:false});}
 }
 return {origin:base.origin,guardsReady:checks.every(c=>c.passed),authenticatedCustomerVerified:false,checks};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const result=await checkMobileReadiness(process.argv[2]);console.log(JSON.stringify(result,null,2));if(!result.guardsReady)process.exitCode=1;}catch(error){console.error(error.message);process.exitCode=1;}}
