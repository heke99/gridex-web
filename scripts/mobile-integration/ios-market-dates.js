// Read the canonical current business day when the market journey starts,
// rather than retaining the date from a potentially hour-old native job.
/* global http, CUSTOMER_ORIGIN, output, json */
var clockResponse=http.get(CUSTOMER_ORIGIN+'/api/elpris/day?area=SE4',{
 headers:{'user-agent':'GridexQualificationDateProbe/1'}
});
if(clockResponse.status!==200)throw new Error('Canonical market date unavailable');
var clockDay=json(clockResponse.body).date;
if(typeof clockDay!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(clockDay))throw new Error('Invalid canonical market date');
var clockTime=Date.parse(clockDay+'T12:00:00Z');
if(!isFinite(clockTime)||new Date(clockTime).toISOString().slice(0,10)!==clockDay)throw new Error('Invalid canonical market date');
output.marketToday=clockDay;
output.marketYesterday=new Date(clockTime-86400000).toISOString().slice(0,10);
output.marketTomorrow=new Date(clockTime+86400000).toISOString().slice(0,10);
