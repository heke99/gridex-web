"""Extra real-device journeys; reuse pinned OPS UI helpers without rerunning its module."""
import json, os, subprocess, sys, time
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
from pathlib import Path
helper=Path('scripts/mobile-android-emulator.py').resolve()
source=helper.read_text(); marker='\nproxy=bridge()\n'
assert source.count(marker)==1, 'Pinned emulator helper structure changed'
scope={'__file__':str(helper),'__name__':'qualification_helpers'}
exec(compile(source.split(marker)[0],str(helper),'exec'),scope)
for name in ['adb','tap','top','enter','launch','wait_for','login','checkpoint','request_count','wait_for_new_request','bridge']:
 globals()[name]=scope[name]
f=scope['fixture'];out=scope['out'];a,b=f['customers']
proxy=subprocess.Popen(['node',str(Path(__file__).resolve().with_name('device-https.mjs'))],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
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
try:
 adb('reverse','tcp:3444','tcp:3444');launch();tap('Mer');wait_for('Logga in på Mina sidor');login(a)
 before=request_count();adb('shell','am','force-stop','se.gridex.el.dev');launch();tap('Mer')
 wait_for(a['display']['contracts'],b['number']);wait_for_new_request(before)
 checkpoint('authenticated-restart-fresh-ops',a['display']['contracts'],b['number'])
 for user,other in [(a,b),(b,a)]:
  if user is b:
   tap('Logga ut');wait_for('Logga in på Mina sidor');login(b)
  for resource,label,expected in [('profile','Profil',user['number']),('notifications','Meddelanden',user['extra']['notificationTitle']),('documents','Dokument',user['extra']['documentTitle']),('powers','Fullmakter','supplier_switch'),('acceptances','Godkännanden','terms'),('support','Support',user['extra']['supportTitle'])]:
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
    count=document_count(user['extra']['document']);tap('Öppna dokument i extern läsare')
    deadline=time.monotonic()+60
    while time.monotonic()<deadline and document_count(user['extra']['document'])<=count:
     for node in scope['nodes']():
      label=node.get('text','')
      if node.get('package')=='com.android.chrome' and node.get('enabled')=='true' and (label in ['Accept & continue','No thanks','Continue','Use without an account'] or 'without an account' in label):
       tap(label,False);break
     time.sleep(1)
    assert document_count(user['extra']['document'])>count,'External Android PDF request not observed'
    launch();checkpoint(user['label']+'-document-external-return',expected,other['number'])
   if resource=='support':
    tap('Öppna ärende och meddelanden');checkpoint(user['label']+'-support-public-messages',user['number']+'-REPLY',other['number'])
    reply='Synthetic Android reply '+user['label'];top();enter('Meddelande till kundservice',reply);tap('Skicka svar')
    wait_for('Meddelandet har sparats.');tap('Hämta igen');checkpoint(user['label']+'-support-native-reply',reply,other['number'])
    if user is a:
     top();tap('← Alla ärenden');enter('Ärendets rubrik','Synthetic Android new A');enter('Meddelande till kundservice','Synthetic Android first message A');tap('Skapa ärende')
     wait_for('Meddelandet har sparats.');tap('Hämta igen');checkpoint('A-support-native-create-readback','Synthetic Android new A',other['number'])
  top()
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
 tap(buttons[0]);checkpoint('market-intervals','Dölj intervallpriser')
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
 proxy.terminate()
 try:proxy.wait(timeout=10)
 except subprocess.TimeoutExpired:proxy.kill();proxy.wait()
