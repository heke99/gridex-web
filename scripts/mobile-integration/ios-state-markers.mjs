// Fixed booleans only. Never export native text, credentials, filenames or subtrees.
export function emptyNativeStateMarkers(){
 return {failureReported:false,hierarchyAvailable:false,hierarchyReadFailed:false,knownReadErrorTextPresent:false,knownDocumentErrorTextPresent:false,loginHeadingPresent:false,authenticatedHeadingPresent:false,busyTextPresent:false,retryControlPresent:false,invoiceHeaderPresent:false,customerAReferencePresent:false,customerBReferencePresent:false,invoiceResourcePresent:false,contractsResourcePresent:false,consumptionResourcePresent:false,customerBusyStatePresent:false,customerIdleStatePresent:false,visibilityEstablished:false};
}
export function nativeStateMarkers(hierarchy,customerA='',customerB=''){
 const flags=emptyNativeStateMarkers();
 if(!hierarchy||typeof hierarchy!=='object'||!hierarchy.attributes||typeof hierarchy.attributes!=='object')return flags;
 flags.hierarchyAvailable=true;
 function visit(node){
  if(!node||typeof node!=='object')return;
  const a=node.attributes;
  const state=typeof a?.['resource-id']==='string'?/^customer-(contracts|sites|invoices|support|invoiceDetail|supportDetail|profile|notifications|documents|powers|acceptances|consumption)-(loading|idle)$/.exec(a['resource-id']):null;
  if(state){
   if(state[1]==='invoiceDetail')flags.invoiceResourcePresent=true;
   if(state[1]==='contracts')flags.contractsResourcePresent=true;
   if(state[1]==='consumption')flags.consumptionResourcePresent=true;
   flags[state[2]==='loading'?'customerBusyStatePresent':'customerIdleStatePresent']=true;
  }
  if(a&&typeof a==='object')for(const key of ['text','accessibilityText','hintText','value']){
   const text=a[key];if(typeof text!=='string')continue;
   if(text.includes('Uppgifterna kunde inte hämtas.'))flags.knownReadErrorTextPresent=true;
   if(text.includes('Dokumentet kunde inte öppnas.'))flags.knownDocumentErrorTextPresent=true;
   if(text.includes('Logga in på Mina sidor'))flags.loginHeadingPresent=true;
   if(text==='Mina sidor')flags.authenticatedHeadingPresent=true;
   if(text.includes('Hämtar kunduppgifter'))flags.busyTextPresent=true;
   if(text==='Hämta igen')flags.retryControlPresent=true;
   if(text.startsWith('Faktura '))flags.invoiceHeaderPresent=true;
   if(customerA&&text.includes(customerA))flags.customerAReferencePresent=true;
   if(customerB&&text.includes(customerB))flags.customerBReferencePresent=true;
  }
  if(Array.isArray(node.children))for(const child of node.children)visit(child);
 }
 visit(hierarchy);return flags;
}
