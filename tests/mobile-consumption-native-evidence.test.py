"""Reject malformed native receipts without rerunning any approved native suite."""
import importlib.util,json,tempfile,unittest,hashlib,subprocess
from unittest.mock import patch
from pathlib import Path
from datetime import datetime,timezone,timedelta
script=Path(__file__).resolve().parents[1]/'scripts/consumption-integration/consumption-native-evidence.py'
spec=importlib.util.spec_from_file_location('consumption_evidence',script);gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)
OPS='a'*40;WEB='b'*40
class NativeEvidence(unittest.TestCase):
 def setUp(self):
  self.directory=tempfile.TemporaryDirectory();self.root=Path(self.directory.name);(self.root/'ui').mkdir()
  self.now=datetime.now(timezone.utc)
  (self.root/'source-metadata.json').write_text(json.dumps({'opsCommit':OPS,'webCommit':WEB,'startedAt':(self.now-timedelta(seconds=1)).isoformat(),'flowSHA256':gate.hashes()}))
  self.xml=f'<testsuites><testsuite tests="1" failures="0" errors="0"><testcase id="consumption-ios" name="consumption-ios" classname="consumption-ios" file="/tmp/scripts/consumption-integration/consumption-ios.yaml" status="SUCCESS" time="1.2" timestamp="{self.now.isoformat()}"/></testsuite></testsuites>'
  (self.root/'ui/results.xml').write_text(self.xml)
  for name in gate.EXPECTED_SHOTS:(self.root/'ui'/name).write_bytes(b'unit-fixture-image')
 def tearDown(self):self.directory.cleanup()
 def test_valid_single_source_bound_case(self):self.assertEqual(gate.verify_ios(self.root,OPS,WEB)['actualJUnitCases'],1)
 def reject_xml(self,xml):
  (self.root/'ui/results.xml').write_text(xml)
  with self.assertRaises(Exception):gate.verify_ios(self.root,OPS,WEB)
 def test_suite_failure_counter_is_not_a_pass(self):self.reject_xml(self.xml.replace('failures="0"','failures="1"'))
 def test_missing_or_unknown_native_status_is_not_a_pass(self):
  for changed in [self.xml.replace(' status="SUCCESS"',''),self.xml.replace('status="SUCCESS"','status="FAILED"')]:self.reject_xml(changed)
 def test_wrong_case_identity_is_not_a_pass(self):self.reject_xml(self.xml.replace('id="consumption-ios"','id="other"'))
 def test_duplicate_case_is_not_a_pass(self):self.reject_xml(self.xml.replace('</testsuite>','<testcase name="consumption-ios"/></testsuite>'))
 def test_stale_source_is_not_a_pass(self):
  with self.assertRaises(Exception):gate.verify_ios(self.root,OPS,'c'*40)
 def test_wrong_eight_screenshot_names_are_not_a_pass(self):
  name=sorted(gate.EXPECTED_SHOTS)[0];(self.root/'ui'/name).rename(self.root/'ui/consumption-a-primary-99.png')
  with self.assertRaises(Exception):gate.verify_ios(self.root,OPS,WEB)
 def test_stale_source_input_hash_is_not_a_pass(self):
  p=self.root/'source-metadata.json';j=json.loads(p.read_text());j['flowSHA256'][gate.INPUTS[0]]='0'*64;p.write_text(json.dumps(j))
  with self.assertRaises(Exception):gate.verify_ios(self.root,OPS,WEB)
 def test_relative_maestro_file_identity_is_accepted(self):
  (self.root/'ui/results.xml').write_text(self.xml.replace('/tmp/scripts/','scripts/'))
  self.assertEqual(gate.verify_ios(self.root,OPS,WEB)['status'],'PASS')
 def test_root_failure_counter_is_not_a_pass(self):self.reject_xml(self.xml.replace('<testsuites>','<testsuites failures="1">'))
 def android_fixture(self):
  rows=[{'scenario':n,'status':'PASS'} for n in sorted(gate.EXPECTED_ANDROID)]
  result={'opsCommit':OPS,'webCommit':WEB,'startedAt':(self.now-timedelta(seconds=2)).isoformat(),'finishedAt':self.now.isoformat(),'results':rows}
  (self.root/'consumption-result.json').write_text(json.dumps(result))
  for n in gate.EXPECTED_ANDROID:
   if '-consumption-' in n:(self.root/(n+'.png')).write_bytes(b'unit-fixture')
  (self.root/'credential-isolation.json').write_text(json.dumps({'webCommit':WEB,'passed':True,'privilegedCredentialEmbedded':False,'privateKeyEmbedded':False}))
  (self.root/'gridex-el-isolated-test.apk').write_bytes(b'unit-apk-fixture')
  (self.root/'SHA256SUMS').write_text(hashlib.sha256(b'unit-apk-fixture').hexdigest()+'  gridex-el-isolated-test.apk\n')
  return result
 def test_android_requires_all_ten_actual_source_bound_assertions(self):
  self.android_fixture();self.assertEqual(gate.verify_android(self.root,OPS,WEB)['actualAssertions'],10)
 def test_android_duplicate_or_failed_assertions_rejected(self):
  for kind in ['duplicate','failed']:
   result=self.android_fixture()
   if kind=='duplicate':result['results'][-1]=result['results'][0]
   else:result['results'][0]['status']='FAIL'
   (self.root/'consumption-result.json').write_text(json.dumps(result))
   with self.assertRaises(Exception):gate.verify_android(self.root,OPS,WEB)
 def test_android_wrong_source_rejected(self):
  self.android_fixture()
  with self.assertRaises(Exception):gate.verify_android(self.root,'c'*40,WEB)
 def test_android_apk_integrity_and_credential_scan_required(self):
  self.android_fixture();(self.root/'gridex-el-isolated-test.apk').write_bytes(b'changed')
  with self.assertRaises(Exception):gate.verify_android(self.root,OPS,WEB)
 def test_owned_simulator_delete_requires_absence_readback(self):
  uid='a'*8+'-'+('b'*4+'-')*3+'c'*12
  identity=self.root/'simulator';identity.write_text(uid);target=self.root/'cleanup.json'
  present={'devices':{'runtime':[{'udid':uid,'name':'GridexConsumption','state':'Booted'}]}}
  with patch.object(gate.subprocess,'check_output',side_effect=[json.dumps(present),json.dumps({'devices':{}})]),patch.object(gate.subprocess,'run') as run:
   gate.cleanup_simulator(identity,target)
   self.assertEqual(run.call_count,2);self.assertTrue(json.loads(target.read_text())['readbackVerified'])
 def test_foreign_simulator_is_never_deleted(self):
  uid='a'*8+'-'+('b'*4+'-')*3+'c'*12;identity=self.root/'simulator';identity.write_text(uid)
  present={'devices':{'runtime':[{'udid':uid,'name':'SomebodyElse','state':'Booted'}]}}
  with patch.object(gate.subprocess,'check_output',return_value=json.dumps(present)),patch.object(gate.subprocess,'run') as run:
   with self.assertRaises(Exception):gate.cleanup_simulator(identity,self.root/'cleanup.json')
   run.assert_not_called()
 def test_android_file_presence_does_not_pass(self):
  (self.root/'consumption-result.json').write_text(json.dumps({'opsCommit':OPS,'webCommit':WEB,'results':[]}))
  with self.assertRaises(Exception):gate.verify_android(self.root,OPS,WEB)
if __name__=='__main__':unittest.main()
