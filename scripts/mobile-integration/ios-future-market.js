/* global http, CUSTOMER_ORIGIN, output, json */
if(typeof output.marketTomorrow!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(output.marketTomorrow))throw new Error('Missing canonical future market date');
var futureResponse=http.get(CUSTOMER_ORIGIN+'/api/elpris/day?area=SE4&date='+output.marketTomorrow,{headers:{'user-agent':'GridexQualificationDateProbe/1'}});
if(futureResponse.status!==200)throw new Error('Canonical future market day unavailable');
var futureDay=json(futureResponse.body);
if(!Array.isArray(futureDay.entries))throw new Error('Invalid canonical future day');
output.futureEntries=futureDay.entries.length;
