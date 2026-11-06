/** Configured origin and prefix only; never accept a URL supplied by API data. */
export function customerEndpoint(origin: string | undefined, suffix: string, cursor?: string, prefix = '/api/mobile/customer'): string {
 const url = new URL(origin ?? '');
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('Invalid customer origin');
 if(!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(prefix))throw new Error('Invalid customer API prefix');
 if(!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(suffix))throw new Error('Invalid customer resource path');
 url.pathname=`${prefix}/${suffix}`;
 if(cursor!==undefined){if(!cursor||cursor.length>2048)throw new Error('Invalid cursor');url.searchParams.set('cursor',cursor);}
 return url.href;
}
export function contractWebUrl(origin: string, action: 'signup' | 'contracts' | 'support'): string {
 const base=new URL(customerEndpoint(origin,'contracts'));
 return new URL(action==='signup'?'/teckna':action==='support'?'/dashboard/support':'/dashboard/contracts',base.origin).href;
}
