// Fixed booleans only. Never export native text, credentials, filenames or subtrees.
export function emptyNativeStateMarkers(){
 return {failureReported:false,hierarchyAvailable:false,hierarchyReadFailed:false,knownReadErrorTextPresent:false,knownDocumentErrorTextPresent:false,loginHeadingPresent:false,authenticatedHeadingPresent:false,busyTextPresent:false,retryControlPresent:false,invoiceHeaderPresent:false,customerAReferencePresent:false,customerBReferencePresent:false,visibilityEstablished:false};
}
export function nativeStateMarkers(hierarchy,customerA='',customerB=''){
 const flags=emptyNativeStateMarkers();
 if(!hierarchy||typeof hierarchy!=='object'||!hierarchy.attributes||typeof hierarchy.attributes!=='object')return flags;
 flags.hierarchyAvailable=true;
 function visit(node){
  if(!node||typeof node!=='object')return;
  const a=node.attributes;
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
