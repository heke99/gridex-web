#!/usr/bin/env bash
# Local simulator identity only; this is never Apple distribution signing.
set -euo pipefail
: "${RUNNER_TEMP:?}" "${APP_PATH:?}"
umask 077
out="$RUNNER_TEMP/gridex-ios-artifacts"
mkdir -p "$out"
python3 - "$APP_PATH" "$RUNNER_TEMP" "$out/simulator-entitlements.plist" <<'PY'
import sys,plistlib
from pathlib import Path
app=Path(sys.argv[1]).resolve();owned=Path(sys.argv[2]).resolve()
if not app.is_relative_to(owned):raise SystemExit('Simulator signing requires an owned temporary app')
with (app/'Info.plist').open('rb') as f:p=plistlib.load(f)
if p.get('CFBundleSupportedPlatforms')!=['iPhoneSimulator'] or p.get('CFBundleIdentifier')!='se.gridex.el.dev':raise SystemExit('Local signing requires the Gridex iPhone simulator app')
with Path(sys.argv[3]).open('wb') as f:plistlib.dump({'application-identifier':p['CFBundleIdentifier'],'keychain-access-groups':[p['CFBundleIdentifier']]},f)
PY
if test -d "$APP_PATH/Frameworks"; then
  while IFS= read -r -d '' framework; do
    codesign --force --sign - --timestamp=none "$framework"
  done < <(find "$APP_PATH/Frameworks" -maxdepth 1 -name '*.framework' -print0)
fi
codesign --force --sign - --timestamp=none --entitlements "$out/simulator-entitlements.plist" "$APP_PATH"
codesign --verify --deep --strict "$APP_PATH"
codesign --display --entitlements :- "$APP_PATH" > "$out/simulator-signed-entitlements.plist" 2> "$out/simulator-signature.txt"
python3 - "$out/simulator-signed-entitlements.plist" "$out/simulator-signing.json" <<'PY'
import sys,plistlib,json
from pathlib import Path
with Path(sys.argv[1]).open('rb') as f:p=plistlib.load(f)
assert p.get('application-identifier')=='se.gridex.el.dev'
assert p.get('keychain-access-groups')==['se.gridex.el.dev']
Path(sys.argv[2]).write_text(json.dumps({'kind':'local-ad-hoc-simulator-signing','bundleId':'se.gridex.el.dev','keychainEntitlementsVerified':True,'distributionSigned':False,'appleDeveloperIdentityUsed':False})+'\n')
PY
