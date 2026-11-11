"""Extra real-device journeys; reuse pinned OPS UI helpers without rerunning its module."""
import json, os, subprocess, sys, time, shlex, re, socket
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
from pathlib import Path
from urllib.parse import urlparse
helper=Path('scripts/mobile-android-emulator.py').resolve()
source=helper.read_text(); marker='\nproxy=bridge()\n'
assert source.count(marker)==1, 'Pinned emulator helper structure changed'
scope={'__file__':str(helper),'__name__':'qualification_helpers'}
exec(compile(source.split(marker)[0],str(helper),'exec'),scope)
for name in ['adb','tap','top','enter','launch','wait_for','login','checkpoint','request_count','wait_for_new_request','bridge']:
 globals()[name]=scope[name]
f=scope['fixture'];out=scope['out'];a,b=f['customers']
# Kept local to Web's extra journeys; OPS's reviewed emulator helper is unchanged.
def enter(label,value):
 tap(label)
 adb('shell','input','keyevent','123')
 adb('shell','input','keyevent',*(['67']*120))
 adb('shell','input','text',shlex.quote(value.replace(' ','%s')))
 adb('shell','input','keyevent','4')

def start_device_proxy():
 child=subprocess.Popen(['node',str(Path(__file__).resolve().with_name('device-https.mjs'))],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 for attempt in range(50):
  if child.poll() is not None:raise RuntimeError('Disposable device proxy exited before readiness')
  try:
   with socket.create_connection(('127.0.0.1',3444),timeout=.2):return child
  except OSError:time.sleep(.1)
 child.terminate();child.wait(timeout=10)
 raise RuntimeError('Disposable device proxy readiness timed out')
proxy=start_device_proxy()
def document_count(reference):
 p=Path(os.environ['RUNNER_TEMP'])/'mobile-document-requests.json'
 rows=json.loads(p.read_text()) if p.exists() else []
 assert all(not r['authorizationPresent'] for r in rows)
 return len([r for r in rows if r['reference']==reference and r['platform']=='android'])
def handoff_count(path):
 p=Path(os.environ['RUNNER_TEMP'])/'mobile-handoff-requests.json'
 rows=json.loads(p.read_text()) if p.exists() else []
 assert all(not r['credentialPresent'] for r in rows)
 return len([r for r in rows if r['path']==path and r['platform']=='android'])
def await_handoff(path,previous):
 deadline=time.monotonic()+45
 while time.monotonic()<deadline and handoff_count(path)<=previous:time.sleep(1)
 assert handoff_count(path)>previous,'Actual external browser handoff not observed'
def seek_checkpoint(name,expected,absent=None):
 top();deadline=time.monotonic()+65
 while time.monotonic()<deadline:
  content=scope['texts'](scope['nodes']())
  if expected in content and (not absent or absent not in content):return checkpoint(name,expected,absent)
  adb('shell','input','swipe','500','1700','500','650','350');time.sleep(.5)
 raise AssertionError('Expected scrolled native checkpoint not reached (values suppressed)')
def native_state_markers(ns,customer_a='',customer_b=''):
 content='\n'.join(n.get('text','')+' '+n.get('content-desc','') for n in ns)
 states=[re.fullmatch(r'customer-(contracts|sites|invoices|support|invoiceDetail|supportDetail|profile|notifications|documents|powers|acceptances|consumption)-(loading|idle)',n.get('resource-id','').split(':id/')[-1]) for n in ns]
 states=[s for s in states if s]
 return {'failureReported':True,'hierarchyAvailable':True,'visibilityEstablished':False,
  'knownReadErrorTextPresent':'Uppgifterna kunde inte hämtas.' in content,
  'knownDocumentErrorTextPresent':'Dokumentet kunde inte öppnas.' in content,
  'loginHeadingPresent':'Logga in på Mina sidor' in content,
  'authenticatedHeadingPresent':any(n.get('text')=='Mina sidor' for n in ns),
  'busyTextPresent':'Hämtar kunduppgifter' in content,'retryControlPresent':'Hämta igen' in content,
  'customerAReferencePresent':bool(customer_a and customer_a in content),'customerBReferencePresent':bool(customer_b and customer_b in content),
  'invoiceResourcePresent':any(s[1]=='invoiceDetail' for s in states),'contractsResourcePresent':any(s[1]=='contracts' for s in states),
  'consumptionResourcePresent':any(s[1]=='consumption' for s in states),'customerBusyStatePresent':any(s[2]=='loading' for s in states),'customerIdleStatePresent':any(s[2]=='idle' for s in states)}
def failure_nodes():
 subprocess.run(['adb','shell','uiautomator','dump','/sdcard/gridex-window.xml'],check=True,timeout=8,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 raw=subprocess.check_output(['adb','exec-out','cat','/sdcard/gridex-window.xml'],timeout=5,stderr=subprocess.DEVNULL)
 return list(scope['ET'].fromstring(raw).iter('node'))
def dismiss_chrome_onboarding(ns):
 # Consent is optional; Chrome can finish it while a hierarchy is being captured.
 for preferred in ['Use without an account','No thanks','Accept & continue','Continue']:
  for node in ns:
   if node.get('package')!='com.android.chrome' or node.get('enabled')!='true' or node.get('text')!=preferred:continue
   match=re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',node.get('bounds',''))
   if not match:continue
   left,top,right,bottom=map(int,match.groups())
   if not(0<=left<right<=8192 and 0<=top<bottom<=8192):continue
   adb('shell','input','tap',str((left+right)//2),str((top+bottom)//2))
   return True
 return False
def open_pdf(reference,expected,other,name):
 count=document_count(reference);tap('Öppna dokument i extern läsare')
 deadline=time.monotonic()+60
 while time.monotonic()<deadline and document_count(reference)<=count:
  ns=scope['nodes']()
  if document_count(reference)>count:break
  dismiss_chrome_onboarding(ns)
  time.sleep(1)
 assert document_count(reference)>count,'External Android PDF request not observed'
 launch();seek_checkpoint(name,expected,other)
def document_available(user,available):
 q=lambda v:"'"+str(v).replace("'","''")+"'"
 url=q(os.environ['GRIDEX_DEVICE_PUBLIC_ORIGIN']+'/qualification-document/'+user['extra']['document']) if available else 'NULL'
 db=urlparse(os.environ['DB_URL']);assert db.hostname=='127.0.0.1' and db.port==54322 and db.path=='/postgres'
 try:subprocess.run(['psql',os.environ['DB_URL'],'-X','-q','-v','ON_ERROR_STOP=1'],input='UPDATE public.customer_documents SET public_url='+url+' WHERE company_id='+q(f['companyId'])+' AND title='+q(user['extra']['documentTitle'])+';',text=True,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 except subprocess.CalledProcessError:raise RuntimeError('Synthetic document mutation failed (details suppressed)') from None

try:
 adb('reverse','tcp:3444','tcp:3444');launch();tap('Mer');wait_for('Logga in på Mina sidor');login(a)
 before=request_count();adb('shell','am','force-stop','se.gridex.el.dev');launch();tap('Mer')
 wait_for(a['display']['contracts'],b['number']);wait_for_new_request(before)
 checkpoint('authenticated-restart-fresh-ops',a['display']['contracts'],b['number'])
 for user,other in [(a,b),(b,a)]:
  if user is b:
   tap('Logga ut');wait_for('Logga in på Mina sidor');login(b)
  top();enter('Sök avtal',other['number']);checkpoint(user['label']+'-contract-search-empty','Inga hämtade poster matchar ditt val.')
  tap('Rensa sökning och filter');checkpoint(user['label']+'-contract-search-clear',user['display']['contracts'],other['number'])
  top();tap('Fakturor');tap('Visa fakturadetaljer');seek_checkpoint(user['label']+'-invoice-lines',user['extra']['invoiceLineTitle'],other['number'])
  open_pdf(user['extra']['invoiceDocument'],user['display']['invoices'],other['number'],user['label']+'-invoice-pdf-external-return')
  for resource,label,expected in [('profile','Profil',user['number']),('notifications','Meddelanden',user['extra']['notificationTitle']),('documents','Dokument',user['extra']['documentTitle']),('powers','Fullmakter',user['extra']['power_of_attorney']),('acceptances','Godkännanden',user['extra']['acceptance']),('support','Support',user['extra']['supportTitle'])]:
   top();tap(label);checkpoint(user['label']+'-'+resource,expected,other['number'])
   if resource=='profile':
    phone='+46733333333' if user is a else '+46744444444'
    enter('Nytt telefonnummer',phone);tap('Spara telefonnummer')
    checkpoint(user['label']+'-phone-write','Telefonnumret har sparats',other['number'])
    tap('Hämta igen');checkpoint(user['label']+'-phone-readback','Telefon: '+phone,other['number'])
   if resource=='notifications' and user is a:
    tap('Markera som läst');wait_for(expected)
    deadline=time.monotonic()+60
    while time.monotonic()<deadline and 'Markera som läst' in scope['texts'](scope['nodes']()):time.sleep(1)
    assert 'Markera som läst' not in scope['texts'](scope['nodes']())
    checkpoint('A-notification-write',expected,other['number'])
   if resource=='documents':
    if user is b:
     count=document_count(user['extra']['document'])
     try:
      document_available(user,False);tap('Öppna dokument i extern läsare')
      checkpoint('B-document-stale-link-fresh-denial','Dokumentet kunde inte öppnas.',other['number'])
      assert document_count(user['extra']['document'])==count
     finally:
      document_available(user,True)
     tap('Hämta igen');wait_for(expected)
    open_pdf(user['extra']['document'],expected,other['number'],user['label']+'-document-external-return')
   if resource=='support':
    top();enter('Sök bland hämtade ärenden',expected);tap('Visa fler ärenden')
    top();enter('Sök bland hämtade ärenden',user['extra']['supportArchiveLast']);checkpoint(user['label']+'-support-continuation-last',user['extra']['supportArchiveLast'],other['number'])
    tap('resolved');checkpoint(user['label']+'-support-status-filter-empty','Inga hämtade poster matchar ditt val.')
    tap('Rensa sökning och filter');top();enter('Sök bland hämtade ärenden',expected)
    tap('Öppna ärende och meddelanden');seek_checkpoint(user['label']+'-support-public-messages',user['number']+'-REPLY',other['number'])
    seek_checkpoint(user['label']+'-support-public-staff-only',user['extra']['publicStaffReply'],user['number']+'-INTERNAL-NEVER-PUBLIC')
    previous=handoff_count('/dashboard/support');tap('Öppna kundservice på webben');await_handoff('/dashboard/support',previous);launch();seek_checkpoint(user['label']+'-support-detail-web-return',user['extra']['publicStaffReply'],other['number'])
    reply='Synthetic Android reply '+user['label'];top();enter('Meddelande till kundservice',reply);checkpoint(user['label']+'-support-complete-message-input',reply,other['number']);tap('Skicka svar')
    wait_for('Meddelandet har sparats.');tap('Hämta igen');seek_checkpoint(user['label']+'-support-native-reply',reply,other['number'])
    if user is a:
     top();tap('← Alla ärenden');top();enter('Sök bland hämtade ärenden','Synthetic Android new A');enter('Ärendets rubrik','Synthetic Android new A');enter('Meddelande till kundservice','Synthetic Android first message A');checkpoint('A-support-complete-first-message-input','Synthetic Android first message A',other['number']);tap('Skapa ärende')
     wait_for('Meddelandet har sparats.');tap('Hämta igen');seek_checkpoint('A-support-native-create-readback','Synthetic Android new A',other['number']);tap('Öppna ärende och meddelanden');seek_checkpoint('A-support-native-create-message-readback','Synthetic Android first message A',other['number'])
  top()
 # Preserve encrypted credentials across a real Auth+customer transport outage.
 top();tap('Fakturor');tap('Visa fakturadetaljer');seek_checkpoint('B-before-offline-foreground',b['display']['invoices'],a['number'])
 proxy.terminate();proxy.wait(timeout=10)
 adb('shell','input','keyevent','3');time.sleep(1);launch()
 seek_checkpoint('B-offline-foreground-private-data-hidden','Uppgifterna kunde inte hämtas.',b['number'])
 top();checkpoint('B-offline-foreground-session-kept','Mina sidor','Logga in på Mina sidor')
 proxy=start_device_proxy();before=request_count();top();tap('Hämta igen')
 seek_checkpoint('B-offline-foreground-fresh-recovery',b['display']['invoices'],a['number']);wait_for_new_request(before)
 top();tap('Förbrukning');checkpoint('consumption-fails-closed-without-delivery-authority','Leveransperioden måste kunna verifieras')
 top();tap('Elpriser');wait_for('Följ elpriset')
 today=datetime.now(ZoneInfo('Europe/Stockholm')).date()
 for area in ['SE1','SE2','SE3','SE4']:
  top();tap(area);checkpoint('market-'+area,str(today)+' · '+area)
 top();tap('Igår');checkpoint('market-yesterday',str(today-timedelta(days=1))+' · SE4')
 top();tap('Idag');wait_for(str(today)+' · SE4')
 buttons=[]
 for attempt in range(7):
  buttons=[n.get('text') for n in scope['nodes']() if (n.get('text') or '').startswith('Visa alla ')]
  if buttons:break
  adb('shell','input','swipe','500','1700','500','650','350');time.sleep(.5)
 assert buttons,'Published market intervals must have an explicit UI result'
 tap(buttons[0]);checkpoint('market-intervals','Dölj intervallpriser');tap('Dölj intervallpriser')
 top();tap('Uppdatera elpriser');wait_for(str(today)+' · SE4')
 proxy.terminate();proxy.wait(timeout=10);tap('Uppdatera elpriser');checkpoint('market-network-error','Elpriserna kunde inte hämtas. Försök igen.')
 proxy=start_device_proxy();top();tap('Uppdatera elpriser');checkpoint('market-retry-recovery',str(today)+' · SE4')
 top();tap('Imorgon');future=today+timedelta(days=1);wait_for(str(future)+' · SE4')
 import urllib.request
 with urllib.request.urlopen('https://gridex.se/api/elpris/day?area=SE4&date='+str(future),timeout=20) as response:future_day=json.load(response)
 assert isinstance(future_day.get('entries'),list)
 if not future_day['entries']:checkpoint('market-unpublished-future-day','Inga priser har publicerats för det valda dygnet.')
 else:checkpoint('market-published-future-day',str(future)+' · SE4')
 top();tap('Mer')
 tap('Logga ut');wait_for('Logga in på Mina sidor')
 previous=handoff_count('/login/forgot-password');tap('Glömt lösenord? Återställ på hemsidan');await_handoff('/login/forgot-password',previous);launch()
 top();tap('E-post');adb('shell','input','keyevent','123');adb('shell','input','keyevent',*(['67']*120));adb('shell','input','keyevent','4')
 checkpoint('recovery-external-return','Logga in på Mina sidor',b['display']['contracts'])
 for label,path in [('Teckna nytt elavtal ↗','/teckna'),('Visa befintliga avtal ↗','/dashboard/contracts'),('Få hjälp att byta avtal ↗','/dashboard/support')]:
  top();tap('Hem');previous=handoff_count(path);tap(label);await_handoff(path,previous);launch();checkpoint('contract-web-handoff-'+path.split('/')[-1],'Teckna och hantera elavtal')
 (out/'expanded-acceptance.json').write_text(json.dumps({'opsCommit':os.environ['GRIDEX_OPS_COMMIT'],'webCommit':os.environ['GRIDEX_WEB_COMMIT'],'results':scope['results'],'consumptionHappyPath':'BLOCKED_MISSING_OPS_DELIVERY_ACCESS','documentProvider':'synthetic-disposable-PDF; production-provider-expiry-not-verified'},indent=2)+'\n')
 print('PASS Android extra account views, phone writes and authenticated restart',flush=True)
finally:
 if sys.exc_info()[0] is not None:
  try:(out/'native-failure-state.json').write_text(json.dumps(native_state_markers(failure_nodes(),a['number'],b['number']))+'\n')
  except Exception:(out/'native-failure-state.json').write_text(json.dumps({'failureReported':True,'hierarchyReadFailed':True,'visibilityEstablished':False})+'\n')
 proxy.terminate()
 try:proxy.wait(timeout=10)
 except subprocess.TimeoutExpired:proxy.kill();proxy.wait()
