import type {CustomerRow,Resource} from './customerData';
const searchFields: Partial<Record<Resource, string[]>> = {
 invoices: ['number'],
 support: ['title', 'description'],
 contracts: ['name'],
 sites: ['address', 'postalCode', 'city', 'facilityId'],
 documents: ['title', 'type'],
 notifications: ['title', 'message'],
};

export function visibleCustomerRows(resource: Resource, rows: CustomerRow[], query: string, status: string) {
 const needle = query.trim().normalize('NFC').toLocaleLowerCase('sv-SE');
 const keys = ['reference', ...(searchFields[resource] ?? [])];
 const visible = rows.filter(row => (status === 'all' || row.status === status) && (
  !needle || keys.some(key => {
   const value = row[key];
   return typeof value === 'string' && value.normalize('NFC').toLocaleLowerCase('sv-SE').includes(needle);
  })
 ));
 const timestamp = (row: CustomerRow, key: string) => {
  const value = row[key];
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
 };
 const sortDate = resource === 'invoices' ? (row: CustomerRow) => timestamp(row, 'dueDate')
  : resource === 'support' ? (row: CustomerRow) => timestamp(row, 'updatedAt') ?? timestamp(row, 'createdAt')
  : resource === 'contracts' ? (row: CustomerRow) => timestamp(row, 'startDate')
  : null;
 if (!sortDate) return visible;
 const direction = resource === 'invoices' ? 1 : -1;
 return visible.sort((first, second) => {
  const a = sortDate(first), b = sortDate(second);
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return direction * (a - b);
 });
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
