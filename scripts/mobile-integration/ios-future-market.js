/* global http, CUSTOMER_ORIGIN, MARKET_TOMORROW, output, json */
var futureResponse=http.get(CUSTOMER_ORIGIN+'/api/elpris/day?area=SE4&date='+MARKET_TOMORROW);
if(futureResponse.status!==200)throw new Error('Canonical future market day unavailable');
var futureDay=json(futureResponse.body);
if(!Array.isArray(futureDay.entries))throw new Error('Invalid canonical future day');
output.futureEntries=futureDay.entries.length;
