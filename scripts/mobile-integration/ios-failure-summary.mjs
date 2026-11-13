import {openSync,readSync,fstatSync,closeSync} from 'node:fs';
import {join} from 'node:path';
import {emptyNativeStateMarkers} from './ios-state-markers.mjs';

// Only call after sanitize-evidence succeeded. Never read the private UI tree.
const directory=process.argv[2];
function read(name,limit,tail=false){
 let descriptor;
 try{
  descriptor=openSync(join(directory,name),'r');const size=fstatSync(descriptor).size;
  const buffer=Buffer.alloc(Math.min(size,limit));
  readSync(descriptor,buffer,0,buffer.length,tail?Math.max(0,size-buffer.length):0);
  return buffer.toString('utf8');
 }catch{return '';}
 finally{if(descriptor!==undefined)closeSync(descriptor);}
}
function bounded(value,limit,tail=false){
 while(Buffer.byteLength(JSON.stringify(value))>limit){
  const length=Math.floor(value.length*0.8);value=tail?value.slice(-length):value.slice(0,length);
 }
 return value;
}
const nativeState=emptyNativeStateMarkers();
try{const data=JSON.parse(read('native-ui-state.json',8192));for(const key of Object.keys(nativeState))nativeState[key]=data[key]===true;}catch{}
const candidate=process.env.QUALIFICATION_WEB_COMMIT??process.env.GITHUB_SHA??'';
const summary={schema:'gridex.ios-failure-summary.v1',nativeStateScope:'union of exported failure hierarchies; not a simultaneous foreground snapshot',source:/^[a-f0-9]{40}$/.test(candidate)?candidate:null,
 junit:bounded(read('results.xml',8192),3500),logTail:bounded(read('maestro.log',8192,true),1800,true),nativeState};
// One JSON line escapes embedded newlines, so diagnostic text cannot become a
// GitHub workflow command. Its inputs are the same sanitized public artifact.
const output=JSON.stringify(summary);
if(Buffer.byteLength(output)>8192)throw Error('Failure summary exceeds its public limit');
console.log(output);
