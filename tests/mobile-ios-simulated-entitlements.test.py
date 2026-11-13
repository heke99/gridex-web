"""Reject device binaries and cross-app simulator identities in native build proof."""
import importlib.util,plistlib,struct,unittest
from pathlib import Path
path=Path(__file__).resolve().parents[1]/'scripts/mobile-integration/ios-simulated-entitlements.py'
spec=importlib.util.spec_from_file_location('simulated_identity',path)
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
def image(identity='se.gridex.el.dev',platform=7,group=None):
 ent=plistlib.dumps({'application-identifier':identity,'keychain-access-groups':[identity if group is None else group]})
 header=struct.pack('<8I',0xfeedfacf,0x100000c,0,2,2,176,0,0)
 build=struct.pack('<6I',0x32,24,platform,0,0,0)
 segment=struct.pack('<2I16s4Q4I',0x19,152,b'__TEXT',0,0,0,0,0,0,1,0)
 section=struct.pack('<16s16s2Q8I',b'__entitlements',b'__TEXT',0,len(ent),208,0,0,0,0,0,0,0)
 return header+build+segment+section+ent
def fat(images):
 offset=8+20*len(images);headers=[]
 for data in images:
  headers.append(struct.pack('>5I',0x100000c,0,offset,len(data),0));offset+=len(data)
 return struct.pack('>2I',0xcafebabe,len(images))+b''.join(headers+images)
class SimulatorIdentity(unittest.TestCase):
 def test_own_simulator(self):
  self.assertEqual(module.inspect(image(),'se.gridex.el.dev')[0]['platform'],7)
 def test_reject_device_and_foreign_identity_or_group(self):
  for data in [image(platform=2),image(identity='foreign.app'),image(group='foreign.keychain')]:
   with self.subTest(data=data[:32]),self.assertRaises(ValueError):module.inspect(data,'se.gridex.el.dev')
 def test_verify_every_universal_slice(self):
  self.assertEqual(len(module.inspect(fat([image(),image()]),'se.gridex.el.dev')),2)
  with self.assertRaises(ValueError):module.inspect(fat([image(),image(identity='foreign.app')]),'se.gridex.el.dev')
 def test_reject_truncated_binary(self):
  with self.assertRaises(ValueError):module.inspect(image()[:180],'se.gridex.el.dev')
if __name__=='__main__':unittest.main()
