#!/usr/bin/env bash
set -euo pipefail
source "$RUNNER_TEMP/mobile-runtime.env"
export EXPO_PUBLIC_CONTRACT_WEB_ORIGIN="$GRIDEX_DEVICE_PUBLIC_ORIGIN"
bash scripts/mobile-android-build.sh
node gridex-web/scripts/mobile-integration/verify-test-apk.mjs "$RUNNER_TEMP/mobile-fixtures/customers.json"
python3 scripts/mobile-android-emulator.py "$RUNNER_TEMP/mobile-fixtures/customers.json"
python3 gridex-web/scripts/mobile-integration/android-features.py "$RUNNER_TEMP/mobile-fixtures/customers.json"
