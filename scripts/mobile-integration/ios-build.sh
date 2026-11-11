#!/usr/bin/env bash
set -euo pipefail
: "${RUNNER_TEMP:?}"
root="$(pwd)"
out="$RUNNER_TEMP/gridex-ios-artifacts"
for variable in LOGIN_A_EMAIL LOGIN_A_PASSWORD LOGIN_B_EMAIL LOGIN_B_PASSWORD GRIDEX_QUALIFICATION_CONTROL_KEY SUPABASE_SERVICE_ROLE_KEY GRIDEX_API_KEY GRIDEX_CUSTOMER_ASSERTION_PRIVATE_KEY; do
  if test -n "${!variable:-}"; then echo 'Native compiler environment must contain public build configuration only.' >&2; exit 1; fi
done
mkdir -p "$out"
trap 'node "$root/scripts/mobile-integration/sanitize-evidence.mjs" log "$out/pods.log" "$out/pods.log"; node "$root/scripts/mobile-integration/sanitize-evidence.mjs" log "$out/build.log" "$out/build.log"' EXIT
xcodebuild -version > "$out/xcode-version.txt"
cd apps/mobile
npm exec --no -- expo prebuild --platform ios --no-install
(cd ios && pod install) > "$out/pods.log" 2>&1
workspace="$(find ios -maxdepth 1 -name '*.xcworkspace' -print -quit)"
test -n "$workspace"
xcodebuild -list -json -workspace "$workspace" > "$RUNNER_TEMP/gridex-ios-project.json"
project="$(find ios -maxdepth 1 -name '*.xcodeproj' -print -quit)"
test -n "$project"
scheme="$(basename "$project" .xcodeproj)"
node -e 'const x=require(process.argv[1]);if(!x.workspace.schemes.includes(process.argv[2]))throw Error("App scheme unavailable")' "$RUNNER_TEMP/gridex-ios-project.json" "$scheme"
# Xcode places these in simulated linker sections, not restricted host entitlements.
python3 - "$RUNNER_TEMP/gridex-simulator.entitlements" <<'PYENT'
import sys,plistlib
with open(sys.argv[1],'wb') as f:plistlib.dump({'application-identifier':'se.gridex.el.dev','keychain-access-groups':['se.gridex.el.dev']},f)
PYENT
xcodebuild -workspace "$workspace" -scheme "$scheme" -configuration Release \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$RUNNER_TEMP/gridex-ios-build" CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- CODE_SIGN_ENTITLEMENTS="$RUNNER_TEMP/gridex-simulator.entitlements" \
  > "$out/build.log" 2>&1
app="$(find "$RUNNER_TEMP/gridex-ios-build/Build/Products/Release-iphonesimulator" -maxdepth 1 -name '*.app' -print -quit)"
test -n "$app"
codesign --verify --deep --strict "$app"
python3 "$root/scripts/mobile-integration/ios-simulated-entitlements.py" "$app/$scheme" se.gridex.el.dev "$out/simulator-simulated-entitlements.json"
codesign --display --entitlements :- "$app" > "$out/simulator-host-entitlements.plist" 2> "$out/simulator-signature.txt"
APP_PATH="$app" GRIDEX_BUILD_KIND=xcode-ad-hoc-simulator-native-release SOURCE_COMMIT="$(git -C "$root" rev-parse HEAD)" node "$root/scripts/mobile-integration/ios-verify.mjs" "$out/build-receipt.json"
ditto -c -k --sequesterRsrc --keepParent "$app" "$out/gridex-ios-simulator.zip"
printf '%s\n' "$app" > "$RUNNER_TEMP/gridex-ios-app-path"
