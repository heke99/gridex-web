import { mkdir, copyFile, lstat, realpath, rm, writeFile, readFile } from 'node:fs/promises';
import { resolve, dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { defineMobileBrand } from '../packages/mobile-foundation/src/brand.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const native = ['index.ts','tsconfig.json','metro.config.mjs','package.json','package-lock.json',
 'src/accountClient.ts','src/accountFetch.ts','src/abortable.ts','src/CustomerAccess.tsx','src/customerData.ts','src/CustomerDetailPanels.tsx',
 'src/CustomerExtraPanel.tsx','src/detailData.ts','src/EnergyAppShell.tsx','src/secureSessionStorage.ts',
 'src/SupportComposer.tsx','src/useCustomerAccount.ts','src/customerEndpoint.ts','src/ContractActions.tsx','src/marketPriceData.ts','src/MarketPrices.tsx','src/PhoneEditor.tsx','src/listTools.ts','src/CustomerList.tsx','src/ConsumptionPanel.tsx'];
const backend = ['package.json','handler.mjs','projection.mjs','demo.mjs','README.md','consumption.mjs','consumption.d.mts'];
const foundation = ['package.json','README.md','src/brand.mjs','src/brand.d.ts','src/ports.d.ts','src/customerDetails.ts'];
const defaultBrand = {id:'energy-demo',displayName:'Energy Demo',supportUrl:'https://example.com/support',theme:{canvas:'#08090b',surface:'#0f1115',text:'#f4f6f7',muted:'#a7afb8',accent:'#35c9d7',accentText:'#041113'}};

/** Source-only transfer. A customer's database and backend are never exported. */
export async function exportMobileApp(destination, options = {}) {
 if (!destination) throw new Error('A new destination directory is required');
 if (Object.keys(options).some(k=>!['brand','applicationId','scheme'].includes(k))) throw new Error('Unknown export option');
 const brand=defineMobileBrand(options.brand??defaultBrand);
 const applicationId=options.applicationId??'com.example.energyapp';
 const scheme=options.scheme??'energy-demo';
 if(typeof applicationId!=='string'||! /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){2,}$/.test(applicationId))throw new Error('Invalid application identifier');
 if(typeof scheme!=='string'||!/^[a-z][a-z0-9-]{1,47}$/.test(scheme))throw new Error('Invalid app scheme');
 const target=resolve(destination), canonical=join(await realpath(dirname(target)),target.slice(dirname(target).length+1));
 const rel=relative(root,canonical);
 if(rel===''||(!rel.startsWith(`..${sep}`)&&rel!=='..'))throw new Error('Destination must be outside the source repository');
 await mkdir(target);
 const copied=[];
 async function reviewedSource(file) {
  let component=root;
  for(const part of file.split('/')){component=join(component,part);if((await lstat(component)).isSymbolicLink())throw new Error('Source symlinks are not exportable');}
  if(!(await lstat(component)).isFile())throw new Error('Only regular files are exportable');
  return component;
 }
 try {
  for(const file of [...native.map(p=>`apps/mobile/${p}`),...foundation.map(p=>`packages/mobile-foundation/${p}`),...backend.map(p=>`packages/customer-backend/${p}`)]) {
   const component=await reviewedSource(file);
   await mkdir(dirname(join(target,file)),{recursive:true});await copyFile(component,join(target,file));copied.push(file);
  }
  const generated={
   'apps/mobile/brands/active.mjs':`import { defineMobileBrand } from '../../../packages/mobile-foundation/src/brand.mjs';\nexport const activeBrand = defineMobileBrand(${JSON.stringify(brand,null,2)});\n`,
   'apps/mobile/App.tsx':"import React from 'react';\nimport { SafeAreaProvider } from 'react-native-safe-area-context';\nimport { activeBrand } from './brands/active.mjs';\nimport { EnergyAppShell } from './src/EnergyAppShell';\nimport { CustomerAccess } from './src/CustomerAccess';\nimport { ContractActions } from './src/ContractActions';\nimport { MarketPrices } from './src/MarketPrices';\nexport default function App(){return <SafeAreaProvider><EnergyAppShell brand={activeBrand} pricePanel={<MarketPrices origin={process.env.EXPO_PUBLIC_PRICES_ORIGIN} theme={activeBrand.theme}/>} contractPanel={<ContractActions origin={process.env.EXPO_PUBLIC_CONTRACT_WEB_ORIGIN} theme={activeBrand.theme}/>} customerPanel={tab=><CustomerAccess brand={activeBrand} consumption={tab==='Förbrukning'}/>} /></SafeAreaProvider>;}\n",
   'apps/mobile/app.config.ts':`import type { ExpoConfig } from 'expo/config';\nconst config: ExpoConfig = ${JSON.stringify({name:brand.displayName,slug:brand.id,version:'0.1.0',orientation:'portrait',userInterfaceStyle:'dark',scheme,ios:{bundleIdentifier:applicationId},android:{package:applicationId},updates:{enabled:false},plugins:[['expo-secure-store',{faceIDPermission:false}]]},null,2)};\nexport default config;\n`,
   '.gitignore':'node_modules/\n.expo/\ndist-android/\ndist-ios/\n.env*\n*.tsbuildinfo\n',
   'README.md':await readFile(await reviewedSource('docs/mobile/portable-app.md'),'utf8'),
   'backend-contract.md':await readFile(await reviewedSource('docs/mobile/backend-contract.md'),'utf8'),
  };
  for(const [path,content]of Object.entries(generated)){await mkdir(dirname(join(target,path)),{recursive:true});await writeFile(join(target,path),content);copied.push(path);}
  const files=[];
  for(const path of copied.sort()){const bytes=await readFile(join(target,path));files.push({path,sha256:createHash('sha256').update(bytes).digest('hex')});}
  await writeFile(join(target,'source-manifest.json'),JSON.stringify({formatVersion:1,kind:'native-source-template',backendIncluded:true,backendKind:'provider-neutral-adapter',customerDataIncluded:false,files},null,2)+'\n');
 }catch(error){await rm(target,{recursive:true,force:true});throw error;}
 return target;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try {const config=process.argv[3]?JSON.parse(await readFile(process.argv[3],'utf8')):{};console.log(await exportMobileApp(process.argv[2],config));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
