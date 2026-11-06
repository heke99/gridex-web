const fields={
 contracts:['name','status','startDate'],sites:['address','postalCode','city','facilityId','priceArea','status'],invoices:['number','status','currency','dueDate','paidAt','amount'],
 support:['title','description','status','createdAt','updatedAt'],profile:['name','email','phone','customerNumber','customerType','status'],notifications:['title','message','severity','status','readAt','createdAt'],
 documents:['title','type','version','status','createdAt','availability'],powers:['scope','status','acceptedAt','validFrom','validTo'],acceptances:['type','documentCode','version','acceptedAt','source'],
 invoiceDetail:['number','status','currency','amount','dueDate','issuedAt','periodStart','periodEnd'],supportDetail:['title','description','status','createdAt','updatedAt','moreMessages'],
};
const project=(row,keys)=>{
 if(!row||typeof row!=='object'||typeof row.reference!=='string'||!row.reference)throw new Error('Missing reference');
 return Object.fromEntries(['reference',...keys].map(k=>{const value=row[k];if(k!=='reference'&&value!==null&&!(typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)))throw new Error('Invalid field');return [k,value];}));
};
export function projectCustomerItems(kind,items){
 if(!fields[kind])throw new Error('Unsupported projection');
 return items.map(row=>{
  const out=project(row,fields[kind]);
  if(kind==='invoiceDetail'){
   if(!Array.isArray(row.lines)||!Array.isArray(row.documents))throw new Error('Invalid invoice');
   out.lines=row.lines.map(v=>project(v,['description','quantity','unitPrice','amountExVat','vatAmount','amountIncVat']));
   out.documents=row.documents.map(v=>project(v,['title','type','available']));
  }
  if(kind==='supportDetail'){
   if(!Array.isArray(row.messages))throw new Error('Invalid messages');
   out.messages=row.messages.map(v=>{if(v.visibility!==undefined&&v.visibility!=='public')throw new Error('Nonpublic message');return project(v,['author','kind','body','createdAt']);});
  }
  return out;
 });
}
