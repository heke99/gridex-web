"""Focused production journey using existing APK. No credential or login-screen logging."""
import hashlib,json,os,re,subprocess,time,xml.etree.ElementTree as ET
from pathlib import Path
out=Path(os.environ['RUNNER_TEMP'])/'production-account-proof';out.mkdir(exist_ok=True)
package='se.gridex.el.dev';results=[]
def adb(*args):
 try:return subprocess.check_output(['adb',*args],stderr=subprocess.DEVNULL)
 except subprocess.CalledProcessError:raise RuntimeError('Android command failed; arguments suppressed') from None
def nodes():
 adb('shell','uiautomator','dump','/sdcard/gridex-production.xml')
 return list(ET.fromstring(adb('exec-out','cat','/sdcard/gridex-production.xml')).iter('node'))
def content():return '\n'.join(n.get('text','')+' '+n.get('content-desc','') for n in nodes())
def visible(label):
 for n in nodes():
  if label not in (n.get('text','')+' '+n.get('content-desc','')):continue
  xy=list(map(int,re.findall(r'-?\d+',n.get('bounds',''))))
  if len(xy)==4 and 0<=xy[0]<xy[2]<=1080 and 0<=xy[1]<xy[3]<=2400 and xy[3]-xy[1]<400:return True
 return False
def wait(label,timeout=75):
 until=time.monotonic()+timeout
 while time.monotonic()<until:
  if visible(label):return
  time.sleep(1)
 raise AssertionError('Required UI checkpoint unavailable; UI values suppressed')
def top():
 for _ in range(5):adb('shell','input','swipe','500','650','500','1750','200')
def tap(label,scroll=True):
 for _ in range(8 if scroll else 1):
  for n in nodes():
   if label in (n.get('text'),n.get('content-desc')) and n.get('enabled')=='true':
    xy=list(map(int,re.findall(r'-?\d+',n.get('bounds',''))))
    if len(xy)==4 and 0<=xy[0]<xy[2]<=1080 and 0<=xy[1]<xy[3]<=2400:
     adb('shell','input','tap',str((xy[0]+xy[2])//2),str((xy[1]+xy[3])//2));return
  adb('shell','input','swipe','500','1700','500','650','300')
 raise AssertionError('Required production control unavailable')
def enter(label,value):
 tap(label);adb('shell','input','keyevent','123');adb('shell','input','keyevent',*(['67']*120));adb('shell','input','text',value);adb('shell','input','keyevent','4')
def checkpoint(name,label,forbidden=None):
 for attempt in range(8):
  if visible(label):break
  adb('shell','input','swipe','500','1700','500','650','300');time.sleep(.5)
 wait(label)
 if forbidden:assert forbidden not in content(),'Previous customer data remains visible'
 if not name.startswith('production-logout'):(out/(name+'.png')).write_bytes(adb('exec-out','screencap','-p'))
 results.append({'scenario':name,'status':'PASS'})
 print('PASS '+name,flush=True)
def launch():adb('shell','am','start','-n',package+'/.MainActivity')
completed=False
started=time.time();apk=Path(os.environ['RUNNER_TEMP'])/'production-apk/gridex-el-test.apk'
try:
 assert os.environ.get('GRIDEX_PRODUCTION_TEST_EMAIL') and os.environ.get('GRIDEX_PRODUCTION_TEST_PASSWORD'),'Credentials unavailable'
 adb('shell','wm','size','1080x2400');adb('shell','wm','density','320');adb('install','-r',str(apk));launch();wait('Gridex El');tap('Mer',False);wait('Logga in på Mina sidor')
 enter('E-post',os.environ['GRIDEX_PRODUCTION_TEST_EMAIL']);enter('Lösenord',os.environ['GRIDEX_PRODUCTION_TEST_PASSWORD']);tap('Logga in')
 checkpoint('production-contract','TEST - Osignerat integrationsavtal')
 top();tap('Anläggningar');checkpoint('production-facility','TEST-PROD-fdb4e8e712')
 top();tap('Fakturor');wait('TEST-INGEN-BETALNING-20261113');tap('Visa fakturadetaljer');wait('Status: issued');checkpoint('production-issued-invoice','Totalt inklusive moms: 0 SEK')
 adb('shell','input','keyevent','3');time.sleep(2);launch();checkpoint('production-background-resume','Totalt inklusive moms: 0 SEK')
 top();tap('Förbrukning',False);wait('30 dagar');tap('30 dagar');checkpoint('production-consumption-30-days','60 kWh i hämtade mätvärden')
 top();tap('Mer',False);top();tap('Logga ut');checkpoint('production-logout','Logga in på Mina sidor','TEST-INGEN-BETALNING')
 adb('shell','am','force-stop',package);launch();wait('Gridex El');tap('Mer',False);checkpoint('production-logout-process-restart','Logga in på Mina sidor','TEST-PROD-')
 completed=True
finally:
 cleanup=True
 try:
  adb('shell','am','force-stop',package);adb('shell','pm','clear',package);adb('shell','rm','-f','/sdcard/gridex-production.xml')
 except RuntimeError:cleanup=False
 result={'status':'PASS' if completed and cleanup and len(results)==7 else 'FAIL','cleanupPassed':cleanup,'startedAtEpoch':started,'finishedAtEpoch':time.time(),'apkSha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'apkSource':'b270ddf792f889dc0a05e4a83bc73954b5e12fef','webOrigin':'https://gridex.se','opsOrigin':'https://app.gridex.se','workflowCommit':os.environ.get('GITHUB_SHA'),'results':results,'scope':'New production test account, zero-amount issued invoice. No rebuild, old suites or Apple distribution.'}
 (out/'result.json').write_text(json.dumps(result,indent=2)+'\n')
 if not cleanup:raise RuntimeError('Android test cleanup failed')
