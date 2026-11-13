import assert from 'node:assert/strict';
import {connect} from 'node:net';
const port=Number(process.argv[2]),mode=process.argv[3];
assert.ok(Number.isInteger(port)&&port>=1024&&port<=65535);assert.ok(['open','closed'].includes(mode));
let matched=false;
for(let attempt=0;attempt<100;attempt++){
 const open=await new Promise(resolve=>{const s=connect(port,'127.0.0.1');s.once('connect',()=>{s.destroy();resolve(true);});s.once('error',()=>resolve(false));s.setTimeout(500,()=>{s.destroy();resolve(false);});});
 if(open===(mode==='open')){matched=true;break;}
 await new Promise(resolve=>setTimeout(resolve,200));
}
assert.ok(matched,'Owned loopback port did not reach required state');
