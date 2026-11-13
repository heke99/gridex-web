"""Strict source-bound native evidence gates. Never turn absence into PASS."""
import argparse,hashlib,json,math,re,subprocess,sys
import xml.etree.ElementTree as ET
from datetime import datetime,timezone,timedelta
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
INPUTS=['scripts/consumption-integration/consumption-ios.yaml','scripts/consumption-integration/consumption-ios-login.yaml','scripts/consumption-integration/consumption-ios-read.yaml','scripts/consumption-integration/consumption-ios-control.js','scripts/mobile-integration/ios-dismiss-keyboard.yaml']
EXPECTED_SHOTS={f'consumption-{actor}-{kind}-{days}.png' for actor in ['a','b'] for kind,days in [('primary',7),('primary',30),('secondary',30),('secondary',7)]}
EXPECTED_ANDROID={f'{actor}-consumption-{kind}{days}' for actor in ['A','B'] for kind,days in [('primary',7),('primary',30),('secondary',30),('secondary',7)]}|{f'{actor}-logout-clears-consumption' for actor in ['A','B']}
def hashes():return {name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in INPUTS}
def instant(value):
 d=datetime.fromisoformat(value.replace('Z','+00:00'));return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d

def verify_ios(directory,ops,web):
 directory=Path(directory);metadata=json.loads((directory/'source-metadata.json').read_text())
 assert metadata['opsCommit']==ops and metadata['webCommit']==web
 assert metadata['flowSHA256']==hashes(),'Actual native input hashes drifted'
 raw=(directory/'ui/results.xml').read_bytes();assert 0<len(raw)<1024*1024
 root=ET.fromstring(raw);assert root.tag in ['testsuites','testsuite']
 suites=[root] if root.tag=='testsuite' else root.findall('.//testsuite');assert len(suites)==1
 for suite in suites:
  assert int(suite.get('tests','0'))==1
  for field in ['failures','errors','skipped']:assert int(suite.get(field,'0'))==0
 for parent in [root,*suites]:
  for field in ['failures','errors','skipped']:assert int(parent.get(field,'0'))==0
 cases=root.findall('.//testcase');assert len(cases)==1
 case=cases[0]
 assert case.get('id')=='consumption-ios' and case.get('name')=='consumption-ios' and case.get('classname')=='consumption-ios'
 assert case.get('status')=='SUCCESS'
 reported_file=case.get('file','');expected_file='scripts/consumption-integration/consumption-ios.yaml'
 assert reported_file==expected_file or reported_file.endswith('/'+expected_file)
 assert not any(root.iter(tag) and list(root.iter(tag)) for tag in ['failure','error','skipped'])
 assert math.isfinite(float(case.get('time','nan'))) and float(case.get('time'))>0
 assert instant(metadata['startedAt'])-timedelta(seconds=60)<=instant(case.get('timestamp',''))<=datetime.now(timezone.utc)+timedelta(seconds=60)
 shots=list((directory/'ui').glob('consumption-*.png'));assert len(shots)==8 and {p.name for p in shots}==EXPECTED_SHOTS
 return {'status':'PASS','opsCommit':ops,'webCommit':web,'actualJUnitCases':1,'positiveConsumptionCheckpoints':8,'logoutAssertions':2,'junitSHA256':hashlib.sha256(raw).hexdigest(),'flowSHA256':metadata['flowSHA256'],'distributionSigned':False,'testFlightVerified':False}

def verify_android(directory,ops,web):
 directory=Path(directory);result=json.loads((directory/'consumption-result.json').read_text());assert result['opsCommit']==ops and result['webCommit']==web
 rows=result['results'];assert len(rows)==10 and {r['scenario'] for r in rows}==EXPECTED_ANDROID and all(r['status']=='PASS' for r in rows)
 assert instant(result['finishedAt'])>=instant(result['startedAt'])
 shots={p.name for p in directory.glob('*-consumption-*.png')};assert shots=={name+'.png' for name in EXPECTED_ANDROID if '-consumption-' in name}
 isolation=json.loads((directory/'credential-isolation.json').read_text());assert isolation['webCommit']==web and isolation['passed'] is True and isolation['privilegedCredentialEmbedded'] is False and isolation['privateKeyEmbedded'] is False
 apk=directory/'gridex-el-isolated-test.apk';actual=hashlib.sha256(apk.read_bytes()).hexdigest();assert (directory/'SHA256SUMS').read_text().split()[0]==actual
 return {'status':'PASS','opsCommit':ops,'webCommit':web,'actualAssertions':10,'positiveConsumptionCheckpoints':8,'apkSHA256':actual}

def cleanup_simulator(identity_file,target):
 identity_file=Path(identity_file);uid=identity_file.read_text().strip();assert re.fullmatch('[A-Fa-f0-9-]{36}',uid)
 def devices():return [d for rows in json.loads(subprocess.check_output(['xcrun','simctl','list','devices','-j'],text=True)).get('devices',{}).values() for d in rows]
 owned=[d for d in devices() if d.get('udid')==uid];assert len(owned)==1 and owned[0]['name']=='GridexConsumption'
 if owned[0]['state']=='Booted':subprocess.run(['xcrun','simctl','shutdown',uid],check=True,stdout=subprocess.DEVNULL)
 subprocess.run(['xcrun','simctl','delete',uid],check=True,stdout=subprocess.DEVNULL)
 assert not any(d.get('udid')==uid for d in devices())
 Path(target).parent.mkdir(parents=True,exist_ok=True);Path(target).write_text(json.dumps({'simulatorCreated':True,'ownedSimulatorDeleted':True,'readbackVerified':True}))

def main():
 p=argparse.ArgumentParser();p.add_argument('mode',choices=['ios','android','cleanup']);p.add_argument('directory');p.add_argument('--ops');p.add_argument('--web');p.add_argument('--output');a=p.parse_args()
 if a.mode=='cleanup':cleanup_simulator(a.directory,a.output);return
 assert re.fullmatch('[a-f0-9]{40}',a.ops or '') and re.fullmatch('[a-f0-9]{40}',a.web or '')
 result=verify_ios(a.directory,a.ops,a.web) if a.mode=='ios' else verify_android(a.directory,a.ops,a.web)
 if a.output:Path(a.output).write_text(json.dumps(result,indent=2)+'\n')
 else:print(json.dumps(result))
if __name__=='__main__':
 try:main()
 except Exception:print('Native consumption evidence invalid (private payload suppressed)',file=sys.stderr);sys.exit(1)
