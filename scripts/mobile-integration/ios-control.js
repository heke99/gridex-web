// Maestro's JS HTTP client. This secret authorizes only disposable test controls.
/* global ACTION, output, http, CUSTOMER_ORIGIN, CONTROL_KEY, json */
var request={action:ACTION};
if(ACTION==='assert-fresh')request.previous=output.previousOpsCount;
if(ACTION.indexOf('assert-handoff-')===0){
 if(output.previousHandoffKind!==ACTION.slice('assert-handoff-'.length))throw new Error('Missing matching handoff baseline');
 request.previous=output.previousHandoffCount;
}
var response=http.post(CUSTOMER_ORIGIN+'/qualification-control',{headers:{'content-type':'application/json','x-qualification-control':CONTROL_KEY},body:JSON.stringify(request)});
if(response.status!==200)throw new Error('Isolated lifecycle control failed');
var result=json(response.body);
if(result.passed!==true)throw new Error('Isolated lifecycle observation failed');
if(ACTION==='snapshot')output.previousOpsCount=result.count;

if(ACTION.indexOf('snapshot-handoff-')===0){output.previousHandoffKind=ACTION.slice('snapshot-handoff-'.length);output.previousHandoffCount=result.handoffCount;}
