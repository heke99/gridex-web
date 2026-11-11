// Android's ephemeral CA is trusted only by its test APK, never by release apps.
import {createServer} from 'node:https';
import {request} from 'node:http';
import {readFileSync} from 'node:fs';
createServer({key:readFileSync(process.env.RUNNER_TEMP+'/ops.key'),cert:readFileSync(process.env.RUNNER_TEMP+'/ops.crt')},(incoming,outgoing)=>{
 const upstream=request({hostname:'127.0.0.1',port:3445,path:incoming.url,method:incoming.method,headers:incoming.headers,timeout:60000},response=>{outgoing.writeHead(response.statusCode??502,response.headers);response.pipe(outgoing);});
 upstream.on('timeout',()=>upstream.destroy());upstream.on('error',()=>{if(!outgoing.headersSent)outgoing.writeHead(503);outgoing.end();});outgoing.on('close',()=>upstream.destroy());incoming.pipe(upstream);
}).listen(3444,'127.0.0.1');
