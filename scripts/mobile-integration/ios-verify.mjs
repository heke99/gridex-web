import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
const app=process.env.APP_PATH;
const plist=JSON.parse(execFileSync('plutil',['-convert','json','-o','-',join(app,'Info.plist')],{encoding:'utf8'}));
assert.equal(plist.CFBundleIdentifier,'se.gridex.el.dev');
assert.equal(plist.CFBundleShortVersionString,'0.1.0');
assert.equal(plist.CFBundleVersion,'1');
assert.equal(plist.ITSAppUsesNonExemptEncryption,false);
assert.notEqual(plist.NSAppTransportSecurity?.NSAllowsArbitraryLoads,true);
assert.equal(plist.NSFaceIDUsageDescription,undefined,'No app biometric prompt is implemented');
assert.ok(plist.CFBundleSupportedPlatforms.includes(process.env.GRIDEX_BUILD_KIND==='unsigned-device-distribution-candidate'?'iPhoneOS':'iPhoneSimulator'));
assert.ok(plist.CFBundleURLTypes.some(t=>t.CFBundleURLSchemes.includes('gridex-el-dev')));
const bundle=readFileSync(join(app,'main.jsbundle'));
for(const origin of [process.env.EXPO_PUBLIC_CUSTOMER_API_URL,process.env.EXPO_PUBLIC_SUPABASE_URL])assert.ok(origin&&bundle.includes(Buffer.from(origin)),'Missing compiled environment');
const simulator=process.env.GRIDEX_BUILD_KIND!=='unsigned-device-distribution-candidate';
if(simulator){
 execFileSync('codesign',['--verify','--deep','--strict',app]);
 const evidence=dirname(process.argv[2]);
 const proof=JSON.parse(readFileSync(join(evidence,'simulator-simulated-entitlements.json'),'utf8'));
 assert.equal(proof.kind,'xcode-simulated-entitlements');assert.equal(proof.passed,true);assert.ok(proof.architectures.length>0);
 assert.ok(proof.architectures.every(a=>a.platform===7&&a.identityScopedToBundle&&a.sections.includes('__entitlements')));
 const hostPath=join(evidence,'simulator-host-entitlements.plist');
 if(readFileSync(hostPath).length){
  const host=JSON.parse(execFileSync('plutil',['-convert','json','-o','-',hostPath],{encoding:'utf8'}));
  for(const key of ['application-identifier','com.apple.application-identifier','keychain-access-groups','com.apple.developer.team-identifier'])assert.equal(host[key],undefined,'Restricted simulator host entitlement');
 }
}
writeFileSync(process.argv[2],JSON.stringify({source:process.env.SOURCE_COMMIT,bundleId:plist.CFBundleIdentifier,version:plist.CFBundleShortVersionString,build:plist.CFBundleVersion,environment:process.env.GRIDEX_BUILD_ENVIRONMENT??'production-public-configuration',kind:process.env.GRIDEX_BUILD_KIND??'xcode-ad-hoc-simulator-native-release',simulatorAdHocSigned:simulator,simulatedIdentityVerified:simulator,distributionSigned:false,testFlightVerified:false,physicalDeviceVerified:false,passed:true},null,2)+'\n');
