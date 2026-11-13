#!/usr/bin/env bash
set -euo pipefail
source "$RUNNER_TEMP/mobile-runtime.env"
export EXPO_PUBLIC_CONTRACT_WEB_ORIGIN="$GRIDEX_DEVICE_PUBLIC_ORIGIN"
env -u DB_URL -u SUPABASE_SERVICE_ROLE_KEY -u GRIDEX_API_KEY -u GRIDEX_CUSTOMER_ASSERTION_PRIVATE_KEY -u GRIDEX_QUALIFICATION_CONTROL_KEY bash scripts/mobile-android-build.sh
node gridex-web/scripts/mobile-integration/verify-test-apk.mjs "$RUNNER_TEMP/mobile-fixtures/customers.json"
python3 gridex-web/scripts/consumption-integration/consumption-android.py "$RUNNER_TEMP/mobile-fixtures/customers.json"
