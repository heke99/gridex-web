// Only disposable iOS document controls use this snapshot. Never infer the
// original link from an environment exported after the gateway was started.
export function documentSnapshot(rows,reference){
 if(!Array.isArray(rows)||rows.length!==1||!/^document_[A-Za-z0-9_-]{32}$/.test(reference??''))throw Error('Invalid synthetic document scope');
 const row=rows[0];
 if(typeof row?.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id)||typeof row.public_url!=='string')throw Error('Invalid synthetic document snapshot');
 let url;try{url=new URL(row.public_url);}catch{throw Error('Invalid synthetic document URL');}
 if(url.protocol!=='https:'||!/^[-a-z0-9]+\.trycloudflare\.com$/.test(url.hostname)||url.port||url.username||url.password||url.search||url.hash||url.pathname!=='/qualification-document/'+reference)throw Error('Invalid synthetic document URL');
 return {id:row.id,publicUrl:row.public_url};
}
