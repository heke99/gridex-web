import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { exportMobileApp } from '../scripts/export-mobile-app.mjs';
const source = new URL('../',import.meta.url).pathname;
const fixture={brand:{id:'other-energy',displayName:'Other Energy',supportUrl:'https://other.example/support',theme:{canvas:'#000000',surface:'#111111',text:'#ffffff',muted:'#aaaaaa',accent:'#22ccdd',accentText:'#000000'}},applicationId:'com.other.energy',scheme:'other-energy'};
async function temporary(fn){const base=await mkdtemp(join(tmpdir(),'mobile-app-export-'));try{await fn(base);}finally{await rm(base,{recursive:true,force:true});}}
test('whole native source exports with neutral branding and a verified source manifest',()=>temporary(async base=>{
 const target=await exportMobileApp(join(base,'app'));const manifest=JSON.parse(await readFile(join(target,'source-manifest.json'),'utf8'));
 assert.equal(manifest.backendIncluded,true);assert.equal(manifest.backendKind,'provider-neutral-adapter');assert.equal(manifest.customerDataIncluded,false);
 assert.ok(manifest.files.some(f=>f.path==='apps/mobile/src/useCustomerAccount.ts'));
 assert.ok(manifest.files.some(f=>f.path==='apps/mobile/package-lock.json'));
 const exported=new Set(manifest.files.map(f=>f.path));
 for(const entry of manifest.files.filter(f=>/\.(?:ts|tsx|mjs)$/.test(f.path))){
  const text=await readFile(join(target,entry.path),'utf8');
  const imports=[...text.matchAll(/\bfrom\s*['"](\.[^'"]+)['"]/g),...text.matchAll(/\bimport\s*['"](\.[^'"]+)['"]/g)];
  for(const match of imports){
   const base=relative(target,resolve(dirname(join(target,entry.path)),match[1]));
   const candidates=[base,...['.ts','.tsx','.mjs','.d.ts','/index.ts','/index.tsx'].map(s=>base+s)];
   assert.ok(candidates.some(p=>exported.has(p)),`Exported relative dependency is missing: ${entry.path} -> ${match[1]}`);
  }
 }

 for(const entry of manifest.files){assert.ok(!/(^|\/)(node_modules|\.env[^/]*|dist[^/]*|\.git|supabase)(\/|$)/.test(entry.path));const bytes=await readFile(join(target,entry.path));assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);}
 const {activeBrand}=await import(pathToFileURL(join(target,'apps/mobile/brands/active.mjs')).href);
 assert.equal(activeBrand.id,'energy-demo');assert.ok(!(await readdir(join(target,'apps/mobile/brands'))).includes('gridex.mjs'));
 assert.equal(await readFile(join(target,'apps/mobile/package-lock.json'),'utf8'),await readFile(join(source,'apps/mobile/package-lock.json'),'utf8'));
}));
test('second customer branding changes native identity and does not mutate source brand',()=>temporary(async base=>{
 const target=await exportMobileApp(join(base,'other'),fixture);
 const {activeBrand}=await import(pathToFileURL(join(target,'apps/mobile/brands/active.mjs')).href);
 assert.equal(activeBrand.displayName,'Other Energy');
 const config=await readFile(join(target,'apps/mobile/app.config.ts'),'utf8');assert.match(config,/com.other.energy/);assert.match(config,/other-energy/);assert.ok(!config.includes('se.gridex'));
 const {gridexBrand}=await import('../apps/mobile/brands/gridex.mjs');assert.equal(gridexBrand.displayName,'Gridex El');
}));
test('export refuses existing destinations without changing their contents',()=>temporary(async base=>{
 const target=await exportMobileApp(join(base,'app'));await writeFile(join(target,'keep.txt'),'keep');await assert.rejects(exportMobileApp(target),{code:'EEXIST'});assert.equal(await readFile(join(target,'keep.txt'),'utf8'),'keep');
}));
test('export rejects repository destinations, including symlinked parents',()=>temporary(async base=>{
 await assert.rejects(exportMobileApp(join(source,'apps','never-export')),/outside/);
 await symlink(source,join(base,'repo'),'dir');await assert.rejects(exportMobileApp(join(base,'repo','never-export')),/outside/);
}));
test('invalid branding, secrets and application identifiers fail before creating output',()=>temporary(async base=>{
 for(const options of [{...fixture,applicationId:'../../escape'},{...fixture,scheme:'bad scheme'},{...fixture,serviceRole:'secret'},{...fixture,brand:{...fixture.brand,apiKey:'secret'}},{...fixture,brand:{...fixture.brand,supportUrl:'http://unsafe.test'}}])await assert.rejects(exportMobileApp(join(base,'invalid'),options));
 assert.deepEqual(await readdir(base),[]);
}));
test('export includes a runnable provider-neutral backend without OPS dependencies',()=>temporary(async base=>{
 const target=await exportMobileApp(join(base,'independent'));
 const {createDemoBackend}=await import(pathToFileURL(join(target,'packages/customer-backend/demo.mjs')).href);
 const response=await createDemoBackend()(new Request('https://buyer.test/customer/v1/profile',{headers:{authorization:'Bearer demo-customer-one-token'}}));
 assert.equal(response.status,200);assert.equal((await response.json()).data.profile[0].reference,'demo-one');
 const pkg=JSON.parse(await readFile(join(target,'packages/customer-backend/package.json'),'utf8'));assert.equal(pkg.dependencies,undefined);
}));
