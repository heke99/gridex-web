// Credentials stay local or hybrid-encrypted to this run's macOS job key.
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes,createCipheriv,createDecipheriv,publicEncrypt,privateDecrypt} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
const [mode,source,target]=process.argv.slice(2);
if(mode==='keypair'){
 mkdirSync(target,{recursive:true,mode:0o700});
 const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:4096});
 writeFileSync(source,privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});
 writeFileSync(join(target,'device-key.json'),JSON.stringify({source:process.env.QUALIFICATION_WEB_COMMIT,publicKey:publicKey.export({type:'spki',format:'pem'})}));
}else if(mode==='encrypt'){
 const f=JSON.parse(readFileSync(source,'utf8'));
 const recipient=JSON.parse(readFileSync(join(process.env.RUNNER_TEMP,'ios-public-key/device-key.json'),'utf8'));
 assert.equal(recipient.source,process.env.GRIDEX_WEB_COMMIT);
 const origin=process.env.GRIDEX_DEVICE_PUBLIC_ORIGIN;
 assert.match(origin,/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/);
 const payload={webCommit:process.env.GRIDEX_WEB_COMMIT,opsCommit:process.env.GRIDEX_OPS_COMMIT,origin,publicKey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,controlKey:process.env.GRIDEX_QUALIFICATION_CONTROL_KEY,customers:f.customers.map(u=>({label:u.label,login:u.login,display:u.display,number:u.number,extra:u.extra}))};
 const key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 const ciphertext=Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]);
 const sealed={key:publicEncrypt({key:recipient.publicKey,oaepHash:'sha256'},key).toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')};
 mkdirSync(target,{recursive:true,mode:0o700});writeFileSync(join(target,'device-fixture.encrypted.json'),JSON.stringify(sealed));
}else if(mode==='decrypt'){
 const s=JSON.parse(readFileSync(source,'utf8'));
 const key=privateDecrypt({key:readFileSync(process.env.GRIDEX_DEVICE_PRIVATE_KEY),oaepHash:'sha256'},Buffer.from(s.key,'base64'));
 const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(s.iv,'base64'));decipher.setAuthTag(Buffer.from(s.tag,'base64'));
 const p=JSON.parse(Buffer.concat([decipher.update(Buffer.from(s.ciphertext,'base64')),decipher.final()]).toString('utf8'));
 assert.equal(p.webCommit,process.env.QUALIFICATION_WEB_COMMIT);assert.match(p.origin,/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/);
 for(const u of p.customers)for(const value of Object.values(u.login))console.log('::add-mask::'+value);
 if(p.controlKey)console.log('::add-mask::'+p.controlKey);
 const values={EXPO_PUBLIC_CUSTOMER_API_URL:p.origin,EXPO_PUBLIC_SUPABASE_URL:p.origin,EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:p.publicKey,EXPO_PUBLIC_CONTRACT_WEB_ORIGIN:p.origin,GRIDEX_QUALIFICATION_CONTROL_KEY:p.controlKey??''};
 for(const u of p.customers){values['LOGIN_'+u.label+'_EMAIL']=u.login.email;values['LOGIN_'+u.label+'_PASSWORD']=u.login.password;values['CUSTOMER_'+u.label]=u.number;values['CONTRACT_'+u.label]=u.display.contracts;values['SITE_'+u.label]=u.display.sites;values['INVOICE_'+u.label]=u.display.invoices;values['DOCUMENT_'+u.label]=u.extra.documentTitle;values['NOTICE_'+u.label]=u.extra.notificationTitle;values['SUPPORT_'+u.label]=u.extra.supportTitle;values['SUPPORT_LAST_'+u.label]=u.extra.supportArchiveLast;values['INVOICE_LINE_'+u.label]=u.extra.invoiceLineTitle;values['INVOICE_DOCUMENT_'+u.label]=u.extra.invoiceDocumentTitle;values['POWER_'+u.label]=u.extra.power_of_attorney;values['ACCEPTANCE_'+u.label]=u.extra.acceptance;}
 const q=v=>"'"+String(v).replaceAll("'","'\\''")+"'";
 writeFileSync(target,Object.entries(values).map(([k,v])=>`export ${k}=${q(v)}`).join('\n')+'\n',{mode:0o600});
}else throw Error('Unknown device fixture operation');
