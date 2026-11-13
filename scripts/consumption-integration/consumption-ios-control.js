/* global ACTION, PHASE, http, output, json, CUSTOMER_ORIGIN, CONTROL_KEY */
var body={action:ACTION};
if(PHASE)body.phase=PHASE;
if(ACTION==='assert'||ACTION==='observed')body.previous=output.consumptionBaseline;
if(ACTION==='auth-observed')body.previous=output.authBaseline;
var response=http.post(CUSTOMER_ORIGIN+'/qualification-consumption',{headers:{'content-type':'application/json','x-qualification-control':CONTROL_KEY},body:JSON.stringify(body)});
if(response.status!==200)throw new Error('Isolated consumption observation failed');
var result=json(response.body);if(result.passed!==true)throw new Error('Invalid consumption control response');
if(ACTION==='snapshot')output.consumptionBaseline=result.count;
if(ACTION==='expectations')for(var i=0;i<result.customers.length;i++){
 var customer=result.customers[i];
 output['secondary'+customer.label]=customer.secondaryTitle;
}

if(ACTION==='observed'){output.currentExpected=result.display;output.currentDate=result.dateLabel;}

if(ACTION==='auth-snapshot')output.authBaseline=result.count;
if(ACTION==='auth-observed'&&!result.successful)throw new Error('Native Auth diagnostic: '+JSON.stringify(result.diagnostic));
