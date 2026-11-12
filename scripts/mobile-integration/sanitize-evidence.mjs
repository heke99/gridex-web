import {emptyNativeStateMarkers,nativeStateMarkers} from './ios-state-markers.mjs';
import {readFileSync,writeFileSync,existsSync,mkdirSync,readdirSync,copyFileSync} from 'node:fs';
import {join,basename} from 'node:path';
const secrets=Object.entries(process.env).filter(([k])=>/LOGIN_.*_(PASSWORD|EMAIL)|SERVICE_ROLE_KEY|QUALIFICATION_CONTROL_KEY/.test(k)).map(([,v])=>v).filter(Boolean);
const fixture=join(process.env.RUNNER_TEMP,'mobile-fixtures/customers.json');
if(existsSync(fixture)){const f=JSON.parse(readFileSync(fixture,'utf8'));secrets.push(...f.secrets,...f.customers.flatMap(u=>Object.values(u.login)),...Object.values(f.unlinked.login));}
function clean(s){for(const value of secrets.filter(v=>v.length>3))s=s.replaceAll(value,'[REDACTED]');return s.replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,'[REDACTED_PRIVATE_KEY]').replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[REDACTED_JWT]').replace(/\bgdxp_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[REDACTED_API_KEY]').replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi,'Bearer [REDACTED]').replace(/postgres(?:ql)?:\/\/[^\s'"<>]+/gi,'[REDACTED_DATABASE_URL]');}
const [mode,source,target]=process.argv.slice(2);
if(mode==='log'){
 if(existsSync(source))writeFileSync(target,clean(readFileSync(source,'utf8')));
}else if(mode==='ios'){
 mkdirSync(target,{recursive:true});
 const markers=emptyNativeStateMarkers();
 const junit=join(source,'results.xml');
 markers.failureReported=existsSync(junit)&&/\bfailures=['"](?:[1-9][0-9]*)['"]|<failure[\s>]/.test(readFileSync(junit,'utf8'));
 const allowed=/^(a-contract|authenticated-restart|a-site|a-invoice|b-contract-no-a-data|b-site-no-a-data|b-invoice-no-a-data|background-resume|expired-token-foreground-refresh|network-recovery|invalidated-session-foreground|invalid-session-not-restored|profile-phone-write|notification-read|document-external-pdf|document-return|consumption-fails-closed|public-market-prices|powers|acceptances|support-public-reply|support-native-write-readback|support-native-create-readback|recovery-external-web|contract-web-return|contract-search-empty|market-future-day|a-invoice-pdf-return|b-invoice-pdf-return|document-stale-link-denied|support-continuation-last|support-status-filter|support-detail-web-return|market-network-error|market-retry-recovery|offline-foreground-session-preserved|keyboard-login-accessible|notched-price-navigation|notched-home-navigation|customer-resource-target)(?:\.png)?$/;
 function walk(dir){if(!existsSync(dir))return;for(const entry of readdirSync(dir,{withFileTypes:true})){const p=join(dir,entry.name);if(entry.isDirectory())walk(p);else if(entry.isFile()&&markers.failureReported&&/^step-\d+-.*\.json$/.test(entry.name)){try{const captured=nativeStateMarkers(JSON.parse(readFileSync(p,'utf8')),process.env.CUSTOMER_A??'',process.env.CUSTOMER_B??'');for(const key of Object.keys(markers))markers[key]||=captured[key];}catch{markers.hierarchyReadFailed=true;}}else if(entry.isFile()&&allowed.test(entry.name)&&entry.name.endsWith('.png'))copyFileSync(p,join(target,basename(p)));}}
 walk(source);
 writeFileSync(join(target,'native-ui-state.json'),JSON.stringify(markers)+'\n');
 for(const file of ['maestro.log','driver-startup-attempt-1.log','results.xml'])if(existsSync(join(source,file)))writeFileSync(join(target,file),clean(readFileSync(join(source,file),'utf8')));
}else throw Error('Unknown sanitization mode');
