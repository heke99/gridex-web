"""Readiness and privacy regressions; no emulator or account credentials needed."""
import contextlib
import hashlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import sys
sys.dont_write_bytecode = True

path = Path(__file__).resolve().parents[1]/'scripts/mobile-integration/android-core-qualify.py'
spec = importlib.util.spec_from_file_location('android_core', path)
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)


class Clock:
    def __init__(self): self.value = 0
    def now(self): return self.value
    def sleep(self, duration): self.value += duration


class CoreTests(unittest.TestCase):
    def test_waits_for_two_own_frames_and_uses_waiting_activity_start(self):
        clock = Clock(); calls = []; reads = 0

        def command(arguments, **options):
            nonlocal reads
            calls.append(arguments)
            self.assertGreater(options['timeout'], 0)
            self.assertLessEqual(options['timeout'], 10)
            if arguments[1] == 'exec-out':
                reads += 1
                package = core.PACKAGE if reads > 1 else 'com.android.launcher'
                return ('<hierarchy><node package="'+package+'"/></hierarchy>').encode()
            return b'ok'

        with patch.object(core.time, 'monotonic', clock.now), patch.object(core.subprocess, 'check_output', side_effect=command):
            result = core.activate(now=clock.now, sleep=clock.sleep)
        self.assertEqual(result, {'attempts': 1, 'stableOwnFrames': 2})
        self.assertEqual(reads, 3)
        self.assertIn(['adb', 'shell', 'am', 'start', '-W', '-n', core.PACKAGE+'/.MainActivity'], calls)

    def test_absent_foreground_has_three_activation_attempts_and_finite_deadline(self):
        clock = Clock(); starts = []
        with self.assertRaisesRegex(RuntimeError, 'readiness not established'):
            core.activate(read=lambda end: [], start=lambda end: starts.append(end), now=clock.now, sleep=clock.sleep)
        self.assertEqual(len(starts), 3)
        self.assertEqual(clock.now(), 30)

    def test_late_own_frame_does_not_pass_readiness(self):
        clock = Clock(); reads = 0

        def read(end):
            nonlocal reads
            reads += 1
            if reads == 2: clock.value = 31
            return [{'package': core.PACKAGE}]

        with self.assertRaisesRegex(RuntimeError, 'readiness not established'):
            core.activate(read=read, start=lambda end: None, now=clock.now, sleep=clock.sleep)

    def fixture(self, directory, fail=False):
        helper = Path(directory)/'core.py'; ready = Path(directory)/'ready'
        prefix = '''from pathlib import Path
events=[]
results=[]
def launch():
    events.append('bare-launch-returned')
class Proxy:
    def terminate(self): events.append('terminate')
    def wait(self, **kwargs): events.append('wait')
def bridge():
    events.append('bridge')
    return Proxy()
'''
        body = f'''try:
    launch()
    assert Path({str(ready)!r}).exists(), 'Original initial heading not ready'
    for index in range(13):
        assert index >= 0
        results.append(index)
    {'raise AssertionError("Original customer assertion failed")' if fail else 'assert len(results) == 13'}
finally:
    proxy.terminate()
    proxy.wait()
'''
        source = prefix+core.MARKER+body
        helper.write_text(source)
        return helper, ready, hashlib.sha256(source.encode()).hexdigest()

    def test_original_early_return_fails_but_unchanged_body_passes_after_readiness(self):
        with tempfile.TemporaryDirectory() as directory:
            helper, ready, digest = self.fixture(directory)
            original = {'__file__': str(helper)}
            with self.assertRaisesRegex(AssertionError, 'initial heading not ready'):
                exec(compile(helper.read_text(), str(helper), 'exec'), original)
            self.assertEqual(original['events'], ['bridge', 'bare-launch-returned', 'terminate', 'wait'])
            launches = []

            def activation():
                launches.append(True); ready.touch()
                return {'attempts': 1, 'stableOwnFrames': 2}

            result = core.run_core(helper, expected_hash=digest, activation=activation)
            self.assertEqual(launches, [True])
            self.assertEqual(result['results'], list(range(13)))
            self.assertEqual(result['events'], ['bridge', 'terminate', 'wait'])
            self.assertEqual(result['__file__'], str(helper.resolve()))

    def test_original_assertion_and_finally_are_preserved_once(self):
        with tempfile.TemporaryDirectory() as directory:
            helper, ready, digest = self.fixture(directory, fail=True)
            ready.touch(); failures = []
            with self.assertRaisesRegex(AssertionError, 'Original customer assertion failed'):
                core.run_core(helper, expected_hash=digest, activation=lambda: {'stableOwnFrames': 2},
                              failure=lambda scope, state: failures.append((scope['events'][:], scope['results'][:])))
            self.assertEqual(failures, [(['bridge', 'terminate', 'wait'], list(range(13)))])

    def test_source_or_marker_change_is_rejected_before_execution(self):
        with tempfile.TemporaryDirectory() as directory:
            helper, ready, digest = self.fixture(directory)
            helper.write_text(helper.read_text()+'\n# unexpected change\n')
            with self.assertRaisesRegex(RuntimeError, 'Pinned Android core source changed'):
                core.run_core(helper, expected_hash=digest)
            self.assertFalse(ready.exists())
            source = helper.read_text()+core.MARKER
            helper.write_text(source)
            with self.assertRaisesRegex(RuntimeError, 'Pinned Android core source changed'):
                core.run_core(helper, expected_hash=hashlib.sha256(source.encode()).hexdigest())

    def test_failure_markers_do_not_export_hierarchy_or_process_values(self):
        with tempfile.TemporaryDirectory() as directory:
            private = 'PRIVATE_LOGIN_OR_SESSION_VALUE'
            nodes = [{'package': core.PACKAGE, 'text': private, 'content-desc': private,
                      'resource-id': 'energy-app-shell'}]
            output = io.StringIO()
            with patch.object(core, 'capture_nodes', return_value=nodes), patch.object(core, 'adb_until', return_value=b'123'), contextlib.redirect_stdout(output):
                core.public_failure({'out': Path(directory)}, {'stable': True})
            raw = output.getvalue()
            self.assertNotIn(private, raw)
            value = json.loads(raw)
            self.assertEqual(set(value), {'schema', 'source', 'markers', 'visibilityEstablished'})
            self.assertTrue(all(isinstance(flag, bool) for flag in value['markers'].values()))
            self.assertTrue(value['markers']['ownPackagePresent'])
            self.assertFalse(value['visibilityEstablished'])
            self.assertEqual(json.loads((Path(directory)/'core-failure-state.json').read_text()), value)


if __name__ == '__main__': unittest.main()
