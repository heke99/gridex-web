#!/usr/bin/env bash
set -euo pipefail
: "${RUNNER_TEMP:?}"
out="$RUNNER_TEMP/gridex-ios-artifacts"
if test "${GRIDEX_IOS_DIAGNOSTIC:-false}" = true; then
  if test "${GRIDEX_IOS_CUSTOMER_FLOW:-false}" = true; then echo 'Keyboard diagnostics cannot run authenticated customer flows.' >&2; exit 1; fi
  for variable in LOGIN_A_EMAIL LOGIN_A_PASSWORD LOGIN_B_EMAIL LOGIN_B_PASSWORD GRIDEX_QUALIFICATION_CONTROL_KEY SUPABASE_SERVICE_ROLE_KEY GRIDEX_API_KEY GRIDEX_CUSTOMER_ASSERTION_PRIVATE_KEY; do
    if test -n "${!variable:-}"; then echo 'Keyboard diagnostics allow public configuration and invalid form data only.' >&2; exit 1; fi
  done
fi
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
# Simulator.app applies its software/hardware keyboard preferences to this device.
open -a Simulator --args -CurrentDeviceUDID "$simulator"
xcrun simctl bootstatus "$simulator" -b
xcrun simctl install "$simulator" "$(cat "$RUNNER_TEMP/gridex-ios-app-path")"
private_ui="$RUNNER_TEMP/gridex-ios-private-ui"
mkdir -p "$private_ui"
preserve_ui_evidence() {
  local result=$?
  trap - EXIT
  if test "${GRIDEX_IOS_DIAGNOSTIC:-false}" = true; then
    installed="$(xcrun simctl get_app_container "$simulator" se.gridex.el.dev app 2>/dev/null || true)"
    if test -n "$installed"; then codesign --verify --deep --strict "$installed" > "$private_ui/installed-signature-after.raw.log" 2>&1 || true; fi
    xcrun simctl spawn "$simulator" log show --style compact --last 15m --predicate 'process == "GridexEl" OR eventMessage CONTAINS[c] "se.gridex.el.dev" OR eventMessage CONTAINS[c] "GridexEl.app" OR eventMessage CONTAINS[c] "GridexEl["' > "$private_ui/simulator-launch.raw.log" 2>&1 || true
    log show --style compact --last 15m --predicate 'process == "GridexEl" OR eventMessage CONTAINS[c] "se.gridex.el.dev" OR eventMessage CONTAINS[c] "GridexEl.app" OR eventMessage CONTAINS[c] "GridexEl["' > "$private_ui/host-launch.raw.log" 2>&1 || true
  fi
  node scripts/mobile-integration/sanitize-evidence.mjs ios "$private_ui" "$out/ui" || result=1
  exit "$result"
}
trap preserve_ui_evidence EXIT
if test "${GRIDEX_IOS_DIAGNOSTIC:-false}" = true; then
  installed="$(xcrun simctl get_app_container "$simulator" se.gridex.el.dev app)"
  codesign --verify --deep --strict "$installed" > "$private_ui/installed-signature-before.raw.log" 2>&1
  direct_result=0
  xcrun simctl launch --terminate-running-process "$simulator" se.gridex.el.dev > "$private_ui/direct-launch.raw.log" 2>&1 || direct_result=$?
  printf '%s\n' "$direct_result" > "$private_ui/direct-launch-status.raw.log"
  sleep 3
  xcrun simctl io "$simulator" screenshot "$private_ui/direct-launch-before-maestro.png"
fi
flow=scripts/mobile-integration/ios-smoke.yaml
if test "${GRIDEX_IOS_DIAGNOSTIC:-false}" = true; then flow=scripts/mobile-integration/ios-keyboard-diagnostic.yaml; fi
environment=(-e "GRIDEX_NATIVE_UI_QUALIFICATION=1")
if test "${GRIDEX_IOS_CUSTOMER_FLOW:-false}" = true; then
  flow=scripts/mobile-integration/ios-customer.yaml
  for variable in LOGIN_A_EMAIL LOGIN_A_PASSWORD LOGIN_B_EMAIL LOGIN_B_PASSWORD CUSTOMER_A CUSTOMER_B CONTRACT_A CONTRACT_B SITE_A SITE_B INVOICE_A INVOICE_B DOCUMENT_B NOTICE_B SUPPORT_B SUPPORT_LAST_B INVOICE_LINE_A INVOICE_LINE_B INVOICE_DOCUMENT_A INVOICE_DOCUMENT_B; do
    environment+=(-e "$variable=${!variable}")
  done
  environment+=(-e "CONTROL_KEY=$GRIDEX_QUALIFICATION_CONTROL_KEY" -e "CUSTOMER_ORIGIN=$EXPO_PUBLIC_CUSTOMER_API_URL")
  market_date="$(node -e 'process.stdout.write(new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Stockholm",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()))')"
  market_yesterday="$(node -e 'process.stdout.write(new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Stockholm",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(Date.parse(process.argv[1]+"T12:00:00Z")-86400000)))' "$market_date")"
  market_tomorrow="$(node -e 'process.stdout.write(new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Stockholm",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(Date.parse(process.argv[1]+"T12:00:00Z")+86400000)))' "$market_date")"
  environment+=(-e "MARKET_DATE=$market_date" -e "MARKET_YESTERDAY=$market_yesterday" -e "MARKET_TOMORROW=$market_tomorrow")
fi
MAESTRO_DRIVER_STARTUP_TIMEOUT=180000 "$RUNNER_TEMP/gridex-maestro/maestro/bin/maestro" --device "$simulator" test \
  --format junit --output "$private_ui/results.xml" \
  --test-output-dir "$private_ui" "${environment[@]}" "$flow" > "$private_ui/maestro.log" 2>&1
node -e 'require("fs").writeFileSync(process.argv[1],JSON.stringify({nativeUiSmoke:"PASS",diagnostic:process.env.GRIDEX_IOS_DIAGNOSTIC==="true",authenticatedCoreCustomerFlowVerified:process.env.GRIDEX_IOS_CUSTOMER_FLOW==="true",webCommit:process.env.QUALIFICATION_WEB_COMMIT??process.env.GITHUB_SHA,consumptionHappyPathVerified:false,distributionSigned:false,testFlightVerified:false,physicalDeviceVerified:false})+"\n")' "$out/simulator-receipt.json"

test -s "$private_ui/results.xml"
test -s "$out/simulator-receipt.json"
