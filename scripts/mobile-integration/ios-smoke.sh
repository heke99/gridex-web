#!/usr/bin/env bash
set -euo pipefail
: "${RUNNER_TEMP:?}"
out="$RUNNER_TEMP/gridex-ios-artifacts"
curl -fsSL --retry 3 https://github.com/mobile-dev-inc/Maestro/releases/download/cli-2.12.1/maestro.zip -o "$RUNNER_TEMP/maestro.zip"
printf '%s  %s\n' 54dbb0716425626604973cbb374c585ca30272375d9ce15177a1152765ddd9d7 "$RUNNER_TEMP/maestro.zip" | shasum -a 256 -c -
unzip -q "$RUNNER_TEMP/maestro.zip" -d "$RUNNER_TEMP/gridex-maestro"
device="$(xcrun simctl list devicetypes -j | node -e 'let x=JSON.parse(require("fs").readFileSync(0,"utf8")).devicetypes;let d=x.find(d=>d.name==="iPhone 17")??x.find(d=>/^iPhone/.test(d.name));if(!d)throw Error("No iPhone type");process.stdout.write(d.identifier)')"
runtime="$(xcrun simctl list runtimes -j | node -e 'let x=JSON.parse(require("fs").readFileSync(0,"utf8")).runtimes.filter(r=>r.isAvailable&&r.identifier.includes("iOS"));if(!x.length)throw Error("No iOS runtime");process.stdout.write(x.at(-1).identifier)')"
simulator="$(xcrun simctl create GridexQualification "$device" "$runtime")"
printf '%s\n' "$simulator" > "$RUNNER_TEMP/gridex-ios-simulator-id"
xcrun simctl boot "$simulator"
xcrun simctl bootstatus "$simulator" -b
xcrun simctl install "$simulator" "$(cat "$RUNNER_TEMP/gridex-ios-app-path")"
"$RUNNER_TEMP/gridex-maestro/maestro/bin/maestro" --device "$simulator" test \
  --format junit --output "$out/smoke-junit.xml" \
  --test-output-dir "$out/ui" scripts/mobile-integration/ios-smoke.yaml
printf '%s\n' '{"nativeUiSmoke":"PASS","realCustomerFlowVerified":false,"physicalDeviceVerified":false}' > "$out/simulator-receipt.json"
