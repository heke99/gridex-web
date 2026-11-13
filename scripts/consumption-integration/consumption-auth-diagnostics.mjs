// Fixed, non-secret diagnostics only. Never persist a body, token, email or password.
export function summarizeGrant(raw,customers){
 let input;try{input=JSON.parse(raw);}catch{return {customer:'unknown',credentialsMatch:false};}
 if(!input||typeof input!=='object'||Array.isArray(input))return {customer:'unknown',credentialsMatch:false};
 const customer=customers.find(c=>typeof input.email==='string'&&c.login.email.toLowerCase()===input.email.toLowerCase());
 return {customer:customer?.label==='A'?'A':customer?.label==='B'?'B':'unknown',credentialsMatch:!!customer&&typeof input.password==='string'&&input.password===customer.login.password};
}
export function summarizeAuthResponse(raw){
 let data;try{data=JSON.parse(raw);}catch{return 'unparseable';}
 if(!data||typeof data!=='object'||Array.isArray(data))return 'unparseable';
 const code=data.error_code??data.code;
 return ['invalid_credentials','over_request_rate_limit','over_email_send_rate_limit','validation_failed','email_not_confirmed','request_timeout'].includes(code)?code:'other';
}
