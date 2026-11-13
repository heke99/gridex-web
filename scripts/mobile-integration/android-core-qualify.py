"""Run the unchanged pinned OPS core journey with bounded activity readiness."""
import hashlib
import json
import os
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

PACKAGE = 'se.gridex.el.dev'
PINNED_CORE_SHA256 = '84d4f0f81e5febaa04c2a05c0c9204080980a7b51584d47f16ea233777d6a2d2'
MARKER = '\nproxy=bridge()\n'


def adb_until(deadline, *arguments):
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise RuntimeError('Android readiness deadline reached (values suppressed)')
    try:
        return subprocess.check_output(['adb', *arguments], stderr=subprocess.DEVNULL,
                                       timeout=min(10, remaining))
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        raise RuntimeError('Android readiness command unavailable (arguments suppressed)') from None


def capture_nodes(deadline):
    adb_until(deadline, 'shell', 'uiautomator', 'dump', '/sdcard/gridex-core-window.xml')
    data = adb_until(deadline, 'exec-out', 'cat', '/sdcard/gridex-core-window.xml')
    try:
        return list(ET.fromstring(data).iter('node'))
    except ET.ParseError:
        raise RuntimeError('Android readiness hierarchy unavailable (values suppressed)') from None


def activate(read=None, start=None, now=time.monotonic, sleep=time.sleep):
    deadline = now() + 30
    read = read or capture_nodes
    start = start or (lambda end: adb_until(end, 'shell', 'am', 'start', '-W', '-n', PACKAGE+'/.MainActivity'))
    attempts = 0
    stable = 0
    next_start = now()
    while now() < deadline:
        if attempts == 0 or (stable == 0 and attempts < 3 and now() >= next_start):
            attempts += 1
            try:
                start(deadline)
            except RuntimeError:
                pass
            next_start = now() + 5
        try:
            nodes = read(deadline)
        except RuntimeError:
            nodes = []
        if now() >= deadline:
            break
        own = any(node.get('package') == PACKAGE for node in nodes)
        stable = stable + 1 if own else 0
        if stable >= 2:
            return {'attempts': attempts, 'stableOwnFrames': 2}
        sleep(min(.25, max(0, deadline-now())))
    raise RuntimeError('Android activity readiness not established (values suppressed)')


def public_failure(scope, launch_state):
    flags = {'hierarchyAvailable': False, 'ownPackagePresent': False,
             'appShellPresent': False, 'brandHeadingPresent': False,
             'loginHeadingPresent': False, 'controlledReadErrorPresent': False,
             'processStatusAvailable': False, 'processPresent': False,
             'launchReachedStableOwnFrames': launch_state['stable']}
    try:
        nodes = capture_nodes(time.monotonic()+5)
        flags['hierarchyAvailable'] = True
        flags['ownPackagePresent'] = any(n.get('package') == PACKAGE for n in nodes)
        flags['appShellPresent'] = any(n.get('resource-id', '').split(':id/')[-1] == 'energy-app-shell' for n in nodes)
        text = '\n'.join(n.get('text', '')+' '+n.get('content-desc', '') for n in nodes)
        flags['brandHeadingPresent'] = 'Gridex El' in text
        flags['loginHeadingPresent'] = 'Logga in på Mina sidor' in text
        flags['controlledReadErrorPresent'] = 'Uppgifterna kunde inte hämtas.' in text
    except Exception:
        pass
    try:
        value = adb_until(time.monotonic()+2, 'shell', 'pidof', PACKAGE)
        flags['processStatusAvailable'] = True
        flags['processPresent'] = bool(re.fullmatch(rb'[0-9 ]+\s*', value.strip()))
    except Exception:
        pass
    source = os.environ.get('QUALIFICATION_WEB_COMMIT', '')
    result = {'schema': 'gridex.android-core-failure.v1',
              'source': source if re.fullmatch('[a-f0-9]{40}', source) else None,
              'markers': flags, 'visibilityEstablished': False}
    output = json.dumps(result)
    (scope['out']/'core-failure-state.json').write_text(output+'\n')
    print(output, flush=True)


def run_core(helper, expected_hash=PINNED_CORE_SHA256, activation=None, failure=None):
    source = Path(helper).read_text()
    if hashlib.sha256(source.encode()).hexdigest() != expected_hash or source.count(MARKER) != 1:
        raise RuntimeError('Pinned Android core source changed; review the entire journey')
    prefix, body = source.split(MARKER)
    scope = {'__file__': str(Path(helper).resolve()), '__name__': 'gridex_pinned_core'}
    exec(compile(prefix, str(helper), 'exec'), scope)
    launch_state = {'stable': False}

    def ready_launch():
        launch_state['stable'] = False
        observation = (activation or activate)()
        launch_state['stable'] = observation['stableOwnFrames'] == 2

    scope['launch'] = ready_launch  # All other original functions/assertions remain unchanged.
    try:
        exec(compile('\n'*prefix.count('\n')+MARKER+body, str(helper), 'exec'), scope)
    except Exception:
        try:
            (failure or public_failure)(scope, launch_state)
        except Exception:
            print('{"schema":"gridex.android-core-failure.v1","diagnosticsUnavailable":true}', flush=True)
        raise
    return scope


if __name__ == '__main__':
    run_core(Path('scripts/mobile-android-emulator.py'))
