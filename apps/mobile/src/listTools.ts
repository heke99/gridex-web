import type {CustomerRow,Resource} from './customerData';
export function visibleCustomerRows(resource:Resource,rows:CustomerRow[],query:string,status:string){
 const needle=query.trim().toLocaleLowerCase('sv-SE');
 return rows.filter(row=>(status==='all'||row.status===status)&&(!needle||[row.reference,...(resource==='invoices'?[row.number]:[row.title,row.description])].some(v=>typeof v==='string'&&v.toLocaleLowerCase('sv-SE').includes(needle))));
}
export function loadedSummary(resource:Resource,rows:CustomerRow[]){
 const statuses=new Map<string,number>();for(const row of rows){const key=typeof row.status==='string'&&row.status?row.status:'Uppgift saknas';statuses.set(key,(statuses.get(key)??0)+1);}
 return {count:rows.length,label:resource==='invoices'?'hämtade fakturor':resource==='support'?'hämtade ärenden':'hämtade poster',statuses:[...statuses].sort(([a],[b])=>a.localeCompare(b,'sv-SE'))};
}
export function calendarDate(value:unknown){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return 'Uppgift saknas';
 const d=new Date(`${value}T12:00:00Z`);if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)return 'Uppgift saknas';
 return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'long',day:'numeric'}).format(d);
}
