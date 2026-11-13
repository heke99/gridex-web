#!/usr/bin/env bash
set -euo pipefail
out="$RUNNER_TEMP/consumption-ios"
private_ui="$RUNNER_TEMP/consumption-ios-private"
test ! -e "$private_ui"
mkdir -p "$out/ui" "$private_ui"
cleanup_ui() {
  local result=$?
  trap - EXIT
  node scripts/mobile-integration/sanitize-evidence.mjs ios "$private_ui" "$out/ui" || result=1
  python3 - "$private_ui" "$out" <<'PY'
import sys,shutil,re
from pathlib import Path
src,out=map(Path,sys.argv[1:])
shots=[p for p in src.rglob('*.png') if re.fullmatch(r'consumption-[ab]-(primary|secondary)-(7|30)\.png',p.name)]
assert len(shots)<=8 and len({p.name for p in shots})==len(shots)
for p in shots:shutil.copyfile(p,out/'ui'/p.name)
PY
  if test "$result" -eq 0; then
    python3 scripts/consumption-integration/consumption-native-evidence.py ios "$out" --ops "$GRIDEX_OPS_COMMIT" --web "$QUALIFICATION_WEB_COMMIT" --output "$out/result.json"
  fi
  exit "$result"
}
trap cleanup_ui EXIT
curl -fsSL --retry 3 https://github.com/mobile-dev-inc/Maestro/releases/download/cli-2.12.1/maestro.zip -o "$RUNNER_TEMP/consumption-maestro.zip"
printf '%s  %s\n' 54dbb0716425626604973cbb374c585ca30272375d9ce15177a1152765ddd9d7 "$RUNNER_TEMP/consumption-maestro.zip" | shasum -a 256 -c -
unzip -q "$RUNNER_TEMP/consumption-maestro.zip" -d "$RUNNER_TEMP/consumption-maestro"
device="$(xcrun simctl list devicetypes -j | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")).devicetypes;process.stdout.write((d.find(x=>x.name==="iPhone 17")??d.find(x=>/^iPhone/.test(x.name))).identifier)')"
runtime="$(xcrun simctl list runtimes -j | node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(0,"utf8")).runtimes.filter(x=>x.isAvailable&&x.identifier.includes("iOS")).at(-1).identifier)')"
simulator="$(xcrun simctl create GridexConsumption "$device" "$runtime")"
printf '%s\n' "$simulator" > "$RUNNER_TEMP/consumption-ios-simulator"
defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false
xcrun simctl boot "$simulator"
open -a Simulator --args -CurrentDeviceUDID "$simulator"
xcrun simctl bootstatus "$simulator" -b
xcrun simctl install "$simulator" "$(cat "$RUNNER_TEMP/gridex-ios-app-path")"
environment=(-e "CUSTOMER_ORIGIN=$EXPO_PUBLIC_CUSTOMER_API_URL" -e "CONTROL_KEY=$GRIDEX_QUALIFICATION_CONTROL_KEY")
for variable in LOGIN_A_EMAIL LOGIN_A_PASSWORD LOGIN_B_EMAIL LOGIN_B_PASSWORD CONTRACT_A CONTRACT_B; do environment+=(-e "$variable=${!variable}"); done
python3 - "$out/source-metadata.json" <<'PYMETA'
import sys,os,json,hashlib
from datetime import datetime,timezone
from pathlib import Path
names=['scripts/consumption-integration/consumption-ios.yaml','scripts/consumption-integration/consumption-ios-login.yaml','scripts/consumption-integration/consumption-ios-read.yaml','scripts/consumption-integration/consumption-ios-control.js','scripts/mobile-integration/ios-dismiss-keyboard.yaml']
Path(sys.argv[1]).write_text(json.dumps({'opsCommit':os.environ['GRIDEX_OPS_COMMIT'],'webCommit':os.environ['QUALIFICATION_WEB_COMMIT'],'startedAt':datetime.now(timezone.utc).isoformat(),'flowSHA256':{n:hashlib.sha256(Path(n).read_bytes()).hexdigest() for n in names}}))
PYMETA
# Only a driver bootstrap failure before any test report may be retried once.
attempt=1
while true; do
 result=0
 MAESTRO_DRIVER_STARTUP_TIMEOUT=300000 "$RUNNER_TEMP/consumption-maestro/maestro/bin/maestro" --device "$simulator" test --format junit --output "$private_ui/results.xml" --test-output-dir "$private_ui" "${environment[@]}" scripts/consumption-integration/consumption-ios.yaml > "$private_ui/maestro.log" 2>&1 || result=$?
 if test "$result" -eq 0; then break; fi
 if test "$attempt" -eq 1 && ! test -e "$private_ui/results.xml" && grep -Fq 'xcuitest.installer.LocalXCTestInstaller$IOSDriverTimeoutException' "$private_ui/maestro.log"; then
  mv "$private_ui/maestro.log" "$private_ui/driver-startup-attempt-1.log"
  attempt=2
  continue
 fi
 exit "$result"
done
