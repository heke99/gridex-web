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
# Real on-screen keyboard is required for keyboard/accessory acceptance.
defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false
xcrun simctl boot "$simulator"
open -a Simulator --args -CurrentDeviceUDID "$simulator"
xcrun simctl bootstatus "$simulator" -b
xcrun simctl install "$simulator" "$(cat "$RUNNER_TEMP/gridex-ios-app-path")"
private_ui="$RUNNER_TEMP/gridex-ios-private-ui"
mkdir -p "$private_ui"
preserve_ui_evidence() {
  local result=$?
  trap - EXIT
  if node scripts/mobile-integration/sanitize-evidence.mjs ios "$private_ui" "$out/ui" >/dev/null 2>&1; then
    if test "$result" -ne 0; then
      node scripts/mobile-integration/ios-failure-summary.mjs "$out/ui" 2>/dev/null || echo 'iOS public failure summary unavailable.'
    fi
  else
    echo 'iOS evidence sanitization failed; private diagnostics withheld.'
    if test "$result" -eq 0; then result=1; fi
  fi
  exit "$result"
}
trap preserve_ui_evidence EXIT
flow=scripts/mobile-integration/ios-smoke.yaml
environment=(-e "GRIDEX_NATIVE_UI_QUALIFICATION=1")
if test "${GRIDEX_IOS_CUSTOMER_FLOW:-false}" = true; then
  flow=scripts/mobile-integration/ios-customer.yaml
  for variable in LOGIN_A_EMAIL LOGIN_A_PASSWORD LOGIN_B_EMAIL LOGIN_B_PASSWORD CUSTOMER_A CUSTOMER_B CONTRACT_A CONTRACT_B SITE_A SITE_B INVOICE_A INVOICE_B DOCUMENT_B NOTICE_B SUPPORT_B SUPPORT_LAST_B INVOICE_LINE_A INVOICE_LINE_B INVOICE_DOCUMENT_A INVOICE_DOCUMENT_B POWER_B ACCEPTANCE_B; do
    environment+=(-e "$variable=${!variable}")
  done
  environment+=(-e "CONTROL_KEY=$GRIDEX_QUALIFICATION_CONTROL_KEY" -e "CUSTOMER_ORIGIN=$EXPO_PUBLIC_CUSTOMER_API_URL")

fi
# Retry only a driver bootstrap failure before Maestro created any test report.
# A started customer journey must never be replayed automatically.
attempt=1
while true; do
  result=0
  MAESTRO_DRIVER_STARTUP_TIMEOUT=300000 "$RUNNER_TEMP/gridex-maestro/maestro/bin/maestro" --device "$simulator" test \
    --format junit --output "$private_ui/results.xml" \
    --test-output-dir "$private_ui" "${environment[@]}" "$flow" > "$private_ui/maestro.log" 2>&1 || result=$?
  if test "$result" -eq 0; then
    break
  fi
  if test "$attempt" -eq 1 && ! test -e "$private_ui/results.xml" && \
      grep -Fq 'xcuitest.installer.LocalXCTestInstaller$IOSDriverTimeoutException' "$private_ui/maestro.log"; then
    mv "$private_ui/maestro.log" "$private_ui/driver-startup-attempt-1.log"
    attempt=2
    continue
  fi
  exit "$result"
done
test -s "$private_ui/results.xml"
node -e 'require("fs").writeFileSync(process.argv[1],JSON.stringify({nativeUiSmoke:"PASS",authenticatedCoreCustomerFlowVerified:process.env.GRIDEX_IOS_CUSTOMER_FLOW==="true",webCommit:process.env.QUALIFICATION_WEB_COMMIT??process.env.GITHUB_SHA,consumptionHappyPathVerified:false,distributionSigned:false,testFlightVerified:false,physicalDeviceVerified:false})+"\n")' "$out/simulator-receipt.json"

test -s "$private_ui/results.xml"
test -s "$out/simulator-receipt.json"
