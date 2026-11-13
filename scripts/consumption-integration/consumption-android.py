"""Only the new positive consumption scope; do not replay the old core suite."""
import json,os,subprocess,sys,time,urllib.request,re
from datetime import datetime,timezone
from pathlib import Path
helper=Path('scripts/mobile-android-emulator.py').resolve();source=helper.read_text();marker='\nproxy=bridge()\n'
assert source.count(marker)==1
scope={'__file__':str(helper),'__name__':'consumption_helpers'}
exec(compile(source.split(marker)[0],str(helper),'exec'),scope)
for name in ['adb','tap','enter','launch','wait_for','checkpoint','texts','nodes','login']:globals()[name]=scope[name]
f=scope['fixture'];out=scope['out'];out.mkdir(exist_ok=True);results=scope['results'];a,b=f['customers']
def top():
 for _ in range(6):adb('shell','input','swipe','500','650','500','1750','200')
def control(action,phase=None,previous=None):
 body={'action':action}
 if phase is not None:body['phase']=phase
 if previous is not None:body['previous']=previous
 request=urllib.request.Request('http://127.0.0.1:3445/qualification-consumption',data=json.dumps(body).encode(),method='POST',headers={'content-type':'application/json','x-qualification-control':os.environ['GRIDEX_QUALIFICATION_CONTROL_KEY']})
 with urllib.request.urlopen(request,timeout=20) as response:
  value=json.load(response);assert value['passed'];return value
original_checkpoint=checkpoint
def checkpoint(name,expected,absent=None):
 ns=wait_for(expected,absent)
 visible=False
 for node in ns:
  if expected not in (node.get('text','')+' '+node.get('content-desc','')):continue
  rect=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
  if len(rect)==4 and 0<=rect[0]<rect[2]<=1080 and 0<=rect[1]<rect[3]<=2400 and rect[3]-rect[1]<400:visible=True
 assert visible,'Consumption result must be visible in the real viewport'
 original_checkpoint(name,expected,absent)
started_at=datetime.now(timezone.utc).isoformat()
proxy=subprocess.Popen(['node','gridex-web/scripts/mobile-integration/device-https.mjs'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 adb('reverse','tcp:3444','tcp:3444');adb('shell','wm','size','1080x2400');adb('shell','wm','density','320')
 adb('install','-r',str(out/'gridex-el-isolated-test.apk'));launch();wait_for('Gridex El');tap('Mer');wait_for('Logga in på Mina sidor')
 for u in [a,b]:
  login(u)
  phase='android:'+u['label']+':primary:7';baseline=control('snapshot',phase)['count'];tap('Förbrukning',scroll=False)
  fresh=control('observed',phase,baseline);expected=fresh['display'];wait_for(expected);wait_for(fresh['dateLabel']);control('assert',phase,baseline);checkpoint(u['label']+'-consumption-primary7',expected)
  for kind,days in [('primary',30),('secondary',30),('secondary',7)]:
   top();phase=f"android:{u['label']}:{kind}:{days}";baseline=control('snapshot',phase)['count']
   if kind=='secondary':tap(u['consumption']['secondaryTitle'])
   tap(str(days)+' dagar');fresh=control('observed',phase,baseline);expected=fresh['display'];wait_for(expected);wait_for(fresh['dateLabel']);control('assert',phase,baseline);checkpoint(u['label']+'-consumption-'+kind+str(days),expected)
  # Leave through the ordinary account view before logging out; no old suite replay.
  tap('Mer',scroll=False);top();tap('Logga ut');wait_for('Logga in på Mina sidor')
  assert 'kWh i hämtade mätvärden' not in texts(nodes())
  results.append({'scenario':u['label']+'-logout-clears-consumption','status':'PASS'})
 (out/'consumption-result.json').write_text(json.dumps({'opsCommit':os.environ['GRIDEX_OPS_COMMIT'],'webCommit':os.environ['GRIDEX_WEB_COMMIT'],'startedAt':started_at,'finishedAt':datetime.now(timezone.utc).isoformat(),'results':results},indent=2))
finally:
 proxy.terminate();proxy.wait(timeout=10);adb('reverse','--remove','tcp:3444');adb('shell','am','force-stop','se.gridex.el.dev')
