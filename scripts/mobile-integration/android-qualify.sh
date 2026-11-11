#!/usr/bin/env bash
set -euo pipefail
source "$RUNNER_TEMP/mobile-runtime.env"
export EXPO_PUBLIC_CONTRACT_WEB_ORIGIN="$GRIDEX_DEVICE_PUBLIC_ORIGIN"
# The compiler needs only public device configuration and the public test CA.
env -u DB_URL -u SUPABASE_SERVICE_ROLE_KEY -u GRIDEX_API_KEY \
  -u GRIDEX_CUSTOMER_ASSERTION_PRIVATE_KEY -u GRIDEX_QUALIFICATION_CONTROL_KEY \
  -u LOGIN_A_EMAIL -u LOGIN_A_PASSWORD -u LOGIN_B_EMAIL -u LOGIN_B_PASSWORD \
  bash scripts/mobile-android-build.sh
node gridex-web/scripts/mobile-integration/verify-test-apk.mjs "$RUNNER_TEMP/mobile-fixtures/customers.json"
python3 scripts/mobile-android-emulator.py "$RUNNER_TEMP/mobile-fixtures/customers.json"
python3 gridex-web/scripts/mobile-integration/android-features.py "$RUNNER_TEMP/mobile-fixtures/customers.json"
