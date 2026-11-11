#!/usr/bin/env bash
# Device SDK compilation is independent of the unavailable Apple signing identity.
set -euo pipefail
: "${RUNNER_TEMP:?}"
root="$(pwd)"; out="$RUNNER_TEMP/gridex-ios-artifacts"
trap 'node "$root/scripts/mobile-integration/sanitize-evidence.mjs" log "$out/device-archive-build.log" "$out/device-archive-build.log"' EXIT
cd apps/mobile
workspace="$(find ios -maxdepth 1 -name '*.xcworkspace' -print -quit)"
project="$(find ios -maxdepth 1 -name '*.xcodeproj' -print -quit)"
test -n "$workspace"; test -n "$project"
scheme="$(basename "$project" .xcodeproj)"
archive="$RUNNER_TEMP/GridexEl-unsigned.xcarchive"
xcodebuild -workspace "$workspace" -scheme "$scheme" -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath "$RUNNER_TEMP/gridex-ios-device-build" -archivePath "$archive" \
  archive CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO > "$out/device-archive-build.log" 2>&1
app="$(find "$archive/Products/Applications" -maxdepth 1 -name '*.app' -print -quit)"
test -n "$app"; test ! -f "$app/embedded.mobileprovision"
APP_PATH="$app" SOURCE_COMMIT="$(git -C "$root" rev-parse HEAD)" GRIDEX_BUILD_KIND=unsigned-device-distribution-candidate \
  node "$root/scripts/mobile-integration/ios-verify.mjs" "$out/device-archive-receipt.json"
binary="$(/usr/libexec/PlistBuddy -c 'Print CFBundleExecutable' "$app/Info.plist")"
xcrun lipo -archs "$app/$binary" > "$out/device-architectures.txt"
grep -Fw arm64 "$out/device-architectures.txt"
ditto -c -k --sequesterRsrc --keepParent "$archive" "$out/GridexEl-unsigned.xcarchive.zip"
