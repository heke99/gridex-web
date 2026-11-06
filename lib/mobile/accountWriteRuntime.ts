import {accountWriteHandler,type AccountWriteKind} from './accountWrites';
import {authenticateMobile,mobileIdentity} from './customerRuntime';
import {submitOpsCustomerProfileUpdate,markOpsCustomerNotificationsRead,fetchOpsCustomerResource} from '@/lib/ops/client';
import {extraRows} from './customerExtras';
export function accountMutation(kind:AccountWriteKind){return accountWriteHandler({
 enabled:()=>process.env.GRIDEX_MOBILE_API_ENABLED==='true',authenticate:authenticateMobile,
 submit:async(subject,token,input,key)=>{
  const identity=await mobileIdentity(subject,token);
  if('phone'in input){
   const result=await submitOpsCustomerProfileUpdate({identity,idempotencyKey:key,profile:{phone:input.phone},metadata:{source:'gridex_mobile'}});
   if(result.status!=='accepted'||result.data?.profile_updated!==true)throw Error('Update not confirmed');
   return {accepted:true};
  }
  await markOpsCustomerNotificationsRead(identity,{notificationIds:[input.reference],operationId:key});
  // A malformed success or a failed read-after-write stays uncertain, preserving retry identity.
  const rows=extraRows('notifications',await fetchOpsCustomerResource(identity,'notifications'));
  const matched=rows.filter(row=>row.reference===input.reference);
  const readAt=matched[0]?.readAt;
  if(matched.length!==1||matched[0].status!=='read'||typeof readAt!=='string'||!Number.isFinite(Date.parse(readAt)))throw Error('Read not confirmed');
  return {accepted:true,readAt};
 }
},kind);}
