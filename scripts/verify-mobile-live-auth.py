import json,urllib.request,urllib.error,concurrent.futures,time,datetime,os,argparse
parser=argparse.ArgumentParser(description="Verify isolated Gridex test identities against real Auth/RLS and mobile HTTP")
parser.add_argument("--config",required=True)
parser.add_argument("--accounts",required=True)
parser.add_argument("--report",required=True)
args=parser.parse_args()
cfg=json.load(open(args.config)); accounts=json.load(open(args.accounts)); base=cfg['NEXT_PUBLIC_SUPABASE_URL']; key=cfg['NEXT_PUBLIC_SUPABASE_ANON_KEY']; report={'started':datetime.datetime.now(datetime.timezone.utc).isoformat(),'deployment':'dpl_3zHRj3GSEoz8s7BMkZh3rBbgfp9r','checks':[],'scope':'Real Supabase Auth/RLS and production mobile HTTP; no device/UI claims'}
def req(url,method='GET',token=None,data=None):
 h={'apikey':key,'Content-Type':'application/json'}
 if token:h['Authorization']='Bearer '+token
 r=urllib.request.Request(url,headers=h,data=None if data is None else json.dumps(data).encode(),method=method)
 started=time.time()
 try:
  try:res=urllib.request.urlopen(r,timeout=40)
  except urllib.error.HTTPError as e:res=e
  raw=res.read(); body=json.loads(raw) if raw else None
  return res.status,body,res.headers,round(time.time()-started,2)
 except Exception as e:return 0,{'error':type(e).__name__},{},round(time.time()-started,2)
def check(name,passed,status=None,**extra):
 row={'name':name,'passed':passed,**({'http':status} if status is not None else {}),**extra};report['checks'].append(row); print(json.dumps(row),flush=True)
if len(accounts)!=2 or any(not a['email'].startswith('gridex-mobile-e2e-') or not a['email'].endswith('@example.invalid') for a in accounts):
 raise SystemExit('Requires exactly two isolated gridex-mobile-e2e test accounts')
sessions=[]
for i,a in enumerate(accounts):
 s,b,h,t=req(base+'/auth/v1/token?grant_type=password','POST',data={'email':a['email'],'password':a['password']})
 check(f'account-{i+1}-password-login',s==200 and b.get('user',{}).get('id')==a['id'],s)
 if s==200:sessions.append((a,b))
for i,(a,b) in enumerate(sessions):
 token=b['access_token']; other=accounts[1-i]['id']
 s,body,h,t=req(base+'/auth/v1/user',token=token);check(f'account-{i+1}-verified-subject',s==200 and body.get('id')==a['id'] and bool(body.get('email_confirmed_at')),s)
 s,body,h,t=req(base+'/rest/v1/customer_profiles?select=user_id&user_id=eq.'+a['id'],token=token);check(f'account-{i+1}-own-profile',s==200 and len(body)==1 and body[0]['user_id']==a['id'],s)
 s,body,h,t=req(base+'/rest/v1/customer_profiles?select=user_id&user_id=eq.'+other,token=token);check(f'account-{i+1}-other-profile-denied',s==200 and body==[],s)
 s,body,h,t=req(base+'/rest/v1/customer_profiles?select=user_id&user_id=eq.'+other,'PATCH',token=token,data={'first_name':'Forbidden E2E write'});check(f'account-{i+1}-other-profile-write-denied',s==403 or (s in (200,204) and body in (None,[])),s)
 jobs=[('contracts','contracts'),('sites','sites'),('profile','profile'),('invoices','invoices'),('foreign-override','contracts?customer_number=foreign')]
 def probe(job):
  name,path=job;s,body,h,t=req('https://gridex.se/api/mobile/customer/'+path,token=token)
  expected=400 if name=='foreign-override' else 503 if name=='profile' else 200
  return name,s,body,h,t,expected
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  for name,s,body,h,t,expected in pool.map(probe,jobs):
   check(f'account-{i+1}-mobile-{name}',s==expected and h.get('Cache-Control')=='private, no-store' and (expected!=200 or body.get('data',{}).get(name)==[]),s,expected=expected,seconds=t,note='Unlinked profile unavailable' if expected==503 else 'Identity override rejected' if expected==400 else 'Confirmed empty own list; no foreign records')
 s,new,h,t=req(base+'/auth/v1/token?grant_type=refresh_token','POST',data={'refresh_token':b['refresh_token']});check(f'account-{i+1}-session-refresh',s==200 and new.get('user',{}).get('id')==a['id'],s)
 if s==200:b=new
 s,body,h,t=req(base+'/auth/v1/logout?scope=global','POST',token=b['access_token']);check(f'account-{i+1}-logout',s in (200,204),s)
 s,body,h,t=req(base+'/auth/v1/token?grant_type=refresh_token','POST',data={'refresh_token':b['refresh_token']});check(f'account-{i+1}-refresh-after-logout-rejected',s in (400,401,403),s)
report['finished']=datetime.datetime.now(datetime.timezone.utc).isoformat();report['realCustomerDataVerified']=False;report['nativeDeviceVerified']=False
with open(args.report,'w') as f:json.dump(report,f,indent=2)

if not all(c['passed'] for c in report['checks']): raise SystemExit(1)
