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
xcodebuild -workspace "$workspace" -scheme "$scheme" -configuration Release \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$RUNNER_TEMP/gridex-ios-build" CODE_SIGNING_ALLOWED=NO \
  > "$out/build.log" 2>&1
app="$(find "$RUNNER_TEMP/gridex-ios-build/Build/Products/Release-iphonesimulator" -maxdepth 1 -name '*.app' -print -quit)"
test -n "$app"
APP_PATH="$app" SOURCE_COMMIT="$(git -C "$root" rev-parse HEAD)" node "$root/scripts/mobile-integration/ios-verify.mjs" "$out/build-receipt.json"
ditto -c -k --sequesterRsrc --keepParent "$app" "$out/gridex-ios-simulator.zip"
printf '%s\n' "$app" > "$RUNNER_TEMP/gridex-ios-app-path"
