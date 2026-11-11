#!/usr/bin/env bash
set -euo pipefail
: "${RUNNER_TEMP:?}"
out="$RUNNER_TEMP/gridex-ios-artifacts"
source_commit="$(node -e 'const x=require(process.argv[1]);if(x.kind!=="unsigned-simulator-native-release"||x.environment!=="production-public-configuration"||x.passed!==true||!(/^[a-f0-9]{40}$/).test(x.source))throw Error("Unexpected native artifact");process.stdout.write(x.source)' "$out/build-receipt.json")"
# Reuse is allowed only while the actual native input trees are identical.
git diff --exit-code "$source_commit" HEAD -- apps/mobile packages/mobile-foundation packages/customer-backend
mkdir -p "$RUNNER_TEMP/gridex-reused-ios-app"
unzip -q "$out/gridex-ios-simulator.zip" -d "$RUNNER_TEMP/gridex-reused-ios-app"
app="$(find "$RUNNER_TEMP/gridex-reused-ios-app" -maxdepth 1 -name '*.app' -print -quit)"
test -n "$app"
printf '%s\n' "$app" > "$RUNNER_TEMP/gridex-ios-app-path"

APP_PATH="$app" bash scripts/mobile-integration/ios-sign-simulator.sh
