"""Exercise the actual native input helper with ADB's remote-shell argument rules."""
import ast,shlex,unittest
from pathlib import Path
source=Path(__file__).resolve().parents[1]/'scripts/mobile-integration/android-features.py'
function=next(n for n in ast.parse(source.read_text()).body if isinstance(n,ast.FunctionDef) and n.name=='enter')
class NativeInput(unittest.TestCase):
 def assert_roundtrip(self,value):
  commands=[]
  scope={'adb':lambda *args:commands.append(args),'tap':lambda label:None,'shlex':shlex}
  exec(compile(ast.Module(body=[function],type_ignores=[]),str(source),'exec'),scope)
  scope['enter']('Synthetic field',value)
  args=next(c for c in commands if c[:3]==('shell','input','text'))
  # adb concatenates remote argv without escaping; Android reads one argument.
  remote=shlex.split(' '.join(args[1:]))
  self.assertEqual(len(remote),3,'Text must remain exactly one remote-shell argument')
  self.assertEqual(remote[2].replace('%s',' '),value)
 def test_multiword_reply(self):self.assert_roundtrip('Synthetic Android reply A')
 def test_literal_shell_characters(self):self.assert_roundtrip("Synthetic O'Brien $(not-a-command)")
if __name__=='__main__':unittest.main()
