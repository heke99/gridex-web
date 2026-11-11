"""Exercise actual PDF helper against Chrome's first-run hierarchy transition."""
import ast,re,unittest
from pathlib import Path
source=Path(__file__).resolve().parents[1]/'scripts/mobile-integration/android-features.py'
class Clock:
 def __init__(self):self.tick=0
 def monotonic(self):self.tick+=10;return self.tick
 def sleep(self,_):pass
class BrowserTransition(unittest.TestCase):
 def exercise(self,request_during_snapshot=False,request_after_tap=False):
  calls=[];state={'count':0,'snapshots':0}
  button={'text':'Use without an account','enabled':'true','package':'com.android.chrome','bounds':'[10,20][110,60]'}
  def nodes():
   state['snapshots']+=1
   if request_during_snapshot:state['count']=1
   return [button]
  def tap(label,*_):
   calls.append(('generic-tap',label))
   if label!='Öppna dokument i extern läsare':raise AssertionError('Required UI control unavailable: '+label)
  def adb(*args):
   calls.append(args)
   if request_after_tap:state['count']=1
  scope={'time':Clock(),'re':re,'document_count':lambda _:state['count'],'tap':tap,'adb':adb,'scope':{'nodes':nodes},'launch':lambda:calls.append(('launch',)),'await_external_reader':lambda:calls.append(('reader-ready',)),'request_count':lambda:0,'wait_for_new_request':lambda previous:calls.append(('fresh-read',previous)),'seek_checkpoint':lambda *args:calls.append(('checkpoint',*args))}
  tree=ast.parse(source.read_text());functions=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['open_pdf','dismiss_chrome_onboarding']]
  exec(compile(ast.Module(body=functions,type_ignores=[]),str(source),'exec'),scope)
  scope['open_pdf']('own-document','own-invoice','foreign-customer','returned')
  return calls,state
 def test_request_arrives_while_onboarding_snapshot_changes(self):
  calls,state=self.exercise(request_during_snapshot=True)
  self.assertEqual(state['snapshots'],1)
  self.assertIn(('checkpoint','returned','own-invoice','foreign-customer'),calls)
  self.assertFalse(any(c[0]=='generic-tap' and c[1]!='Öppna dokument i extern läsare' for c in calls))
 def test_consent_uses_captured_bounds_without_reselecting_label(self):
  calls,state=self.exercise(request_after_tap=True)
  self.assertEqual(state['snapshots'],1)
  self.assertIn(('shell','input','tap','60','40'),calls)
 def test_absent_pdf_request_never_becomes_success(self):
  with self.assertRaisesRegex(AssertionError,'External Android PDF request not observed'):self.exercise()
 def test_foreign_controls_and_invalid_bounds_are_never_tapped(self):
  calls=[];scope={'re':re,'adb':lambda *args:calls.append(args)}
  fn=next(n for n in ast.parse(source.read_text()).body if isinstance(n,ast.FunctionDef) and n.name=='dismiss_chrome_onboarding')
  exec(compile(ast.Module(body=[fn],type_ignores=[]),str(source),'exec'),scope)
  nodes=[{'text':'Use without an account','enabled':'true','package':package,'bounds':bounds} for package,bounds in [('se.gridex.el.dev','[10,20][110,60]'),('com.android.chrome','[-1,0][100,60]'),('com.android.chrome','[10,20][10,60]')]]
  self.assertFalse(scope['dismiss_chrome_onboarding'](nodes));self.assertEqual(calls,[])
class FailureStatePrivacy(unittest.TestCase):
 def test_only_fixed_booleans_leave_the_private_native_hierarchy(self):
  scope={'re':re}
  functions=[n for n in ast.parse(source.read_text()).body if isinstance(n,ast.FunctionDef) and n.name in ['native_state_markers','app_foreground']]
  exec(compile(ast.Module(body=functions,type_ignores=[]),str(source),'exec'),scope)
  secret='SYNTHETIC_PRIVATE_INPUT'
  rows=[{'text':secret,'content-desc':'customer-B'}, {'text':'Mina sidor','resource-id':'se.gridex.el.dev:id/customer-invoiceDetail-loading'}, {'text':'Uppgifterna kunde inte hämtas. Kontrollera anslutningen och försök igen.'}, {'resource-id':'customer-'+secret+'-idle'}]
  rows.append({'package':'com.android.chrome'})
  flags=scope['native_state_markers'](rows,'customer-A','customer-B','pdf-return-seek')
  self.assertTrue(all(type(value) is bool for value in flags.values()))
  self.assertTrue(flags['invoiceResourcePresent']);self.assertTrue(flags['customerBusyStatePresent'])
  self.assertTrue(flags['knownReadErrorTextPresent']);self.assertTrue(flags['customerBReferencePresent'])
  self.assertTrue(flags['chromeWindowPresent']);self.assertTrue(flags['pdfReturnSeekPhase']);self.assertFalse(flags['appWindowPresent'])
  self.assertFalse(flags['customerIdleStatePresent']);self.assertFalse(flags['visibilityEstablished'])
  self.assertNotIn(secret,str(flags));self.assertNotIn('customer-B',str(flags))
class ForegroundReturn(unittest.TestCase):
 def functions(self,names,scope):
  functions=[n for n in ast.parse(source.read_text()).body if isinstance(n,ast.FunctionDef) and n.name in names]
  exec(compile(ast.Module(body=functions,type_ignores=[]),str(source),'exec'),scope)
 def test_reader_that_activates_late_cannot_steal_the_verified_return(self):
  class Clock:
   tick=0
   def monotonic(self):return self.tick
   def sleep(self,_):self.tick+=1
  clock=Clock();state={'front':'com.android.chrome','launches':0,'frames':0,'stolen':False};calls=[]
  def nodes():
   state['frames']+=1
   if state['launches']==1 and state['frames']>=3 and not state['stolen']:
    state['front']='com.android.chrome';state['stolen']=True
   return [{'package':state['front']}]
  def adb(*args):
   calls.append(args);state['launches']+=1;state['front']='se.gridex.el.dev'
  scope={'time':clock,'failure_nodes':nodes,'adb':adb}
  self.functions(['app_foreground','launch'],scope);scope['launch']()
  self.assertEqual(state['launches'],2);self.assertTrue(state['stolen']);self.assertEqual(state['front'],'se.gridex.el.dev')
  self.assertTrue(all('-W' in command for command in calls))
 def test_pdf_receipt_does_not_replace_waiting_for_the_external_reader(self):
  class Clock:
   tick=0
   def monotonic(self):return self.tick
   def sleep(self,_):self.tick+=1
  windows=iter(['se.gridex.el.dev','com.android.chrome','se.gridex.el.dev','com.android.chrome','com.android.chrome']);seen=[]
  def nodes():
   package=next(windows);seen.append(package);return [{'package':package}]
  scope={'time':Clock(),'failure_nodes':nodes}
  self.functions(['app_foreground','await_external_reader'],scope);scope['await_external_reader']()
  self.assertEqual(len(seen),5)
 def test_return_seek_reactivates_app_instead_of_scrolling_the_pdf_reader(self):
  class Clock:
   tick=0
   def monotonic(self):return self.tick
   def sleep(self,_):self.tick+=1
  state={'front':'com.android.chrome'};calls=[]
  def nodes():return [{'package':state['front'],'text':'own-invoice' if state['front']=='se.gridex.el.dev' else 'reader'}]
  def launch():state['front']='se.gridex.el.dev';calls.append('launch')
  scope={'time':Clock(),'failure_nodes':nodes,'launch':launch,'top':lambda:None,'checkpoint':lambda *args:calls.append('checkpoint'),'adb':lambda *args:self.fail('The reader must not be scrolled'),'scope':{'nodes':nodes,'texts':lambda ns:' '.join(n.get('text','') for n in ns)}}
  self.functions(['app_foreground','seek_checkpoint'],scope)
  scope['seek_checkpoint']('returned','own-invoice','foreign-customer')
  self.assertEqual(calls,['launch','checkpoint'])
if __name__=='__main__':unittest.main()
