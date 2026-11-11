#!/usr/bin/env bash
set -eo pipefail
: "${RUNNER_TEMP:?}" "${GRIDEX_OPS_COMMIT:?}" "${QUALIFICATION_WEB_COMMIT:?}"
export GRIDEX_WEB_COMMIT="$QUALIFICATION_WEB_COMMIT" GITHUB_SHA="$GRIDEX_OPS_COMMIT"
unset GRIDEX_REPLAY_DB_URL
python3 - <<'PY'
from pathlib import Path
p=Path('supabase/config.toml');s=p.read_text();assert 'jwt_expiry = 3600' in s;p.write_text(s.replace('jwt_expiry = 3600','jwt_expiry = 60'))
PY
source scripts/gridex-aud-003-clean-replay.sh
owned_pids=()
qualification_cleanup() {
  local result=$?
  trap - EXIT
  for pid in "${owned_pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  node gridex-web/scripts/mobile-integration/sanitize-evidence.mjs log "$RUNNER_TEMP/mobile-stack.log" "$RUNNER_TEMP/mobile-stack-sanitized.log" || true
  node gridex-web/scripts/mobile-integration/sanitize-evidence.mjs log "$RUNNER_TEMP/ops-runtime.log" "$RUNNER_TEMP/mobile-ops-sanitized.log" || true
  node gridex-web/scripts/mobile-integration/sanitize-evidence.mjs log "$RUNNER_TEMP/web-runtime.log" "$RUNNER_TEMP/mobile-web-sanitized.log" || true
  rm -rf "$RUNNER_TEMP/mobile-fixtures"
  rm -f "$RUNNER_TEMP/ops.key" "$RUNNER_TEMP/ops.crt"
  rm -f "$RUNNER_TEMP/mobile-runtime.env"
  set +e
  (exit "$result"); cleanup
  exit "$result"
}
trap qualification_cleanup EXIT
export DB_URL
status="$(supabase status -o json)"
export NEXT_PUBLIC_SUPABASE_URL="$(jq -er .API_URL <<< "$status")"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$(jq -er .ANON_KEY <<< "$status")"
export SUPABASE_SERVICE_ROLE_KEY="$(jq -er .SERVICE_ROLE_KEY <<< "$status")"
node scripts/mobile-ops-fixtures.mjs "$RUNNER_TEMP/mobile-fixtures"
node gridex-web/scripts/mobile-integration/fixtures.mjs "$RUNNER_TEMP/mobile-fixtures/customers.json"
export GRIDEX_PORTAL_IDENTITY_ENFORCEMENT=enforce
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=localhost \
  -addext subjectAltName=IP:127.0.0.1 -keyout "$RUNNER_TEMP/ops.key" -out "$RUNNER_TEMP/ops.crt" 2>/dev/null
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3101 > "$RUNNER_TEMP/ops-runtime.log" 2>&1 &
owned_pids+=("$!")
start_bridge() {
  node scripts/mobile-e2e-ops-https.mjs "$RUNNER_TEMP/ops.key" "$RUNNER_TEMP/ops.crt" &
  bridge_pid=$!
  owned_pids+=("$bridge_pid")
}
start_bridge
curl --fail --silent --retry 20 --retry-all-errors --retry-delay 3 --max-time 30 \
  --cacert "$RUNNER_TEMP/ops.crt" https://127.0.0.1:3443/api/v1/openapi/customer-portal-v1.json --output /dev/null
start_web() { (
  cd gridex-web
  source "$RUNNER_TEMP/mobile-fixtures/web.env"
  export NODE_EXTRA_CA_CERTS="$RUNNER_TEMP/ops.crt"
  export GRIDEX_OPS_API_URL=https://127.0.0.1:3443/api/v1
  export GRIDEX_OPS_STAGING_ALLOWED_ORIGINS=https://127.0.0.1:3443
  export GRIDEX_MOBILE_API_ENABLED=true
  export GRIDEX_MOBILE_DOCUMENT_ORIGINS="${GRIDEX_DEVICE_PUBLIC_ORIGIN:-}"
  exec node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100
) > "$RUNNER_TEMP/web-runtime.log" 2>&1 &
web_pid=$!; owned_pids+=("$web_pid"); }
start_web
curl --silent --retry 20 --retry-connrefused --retry-delay 3 --max-time 60 http://127.0.0.1:3100/api/mobile/customer/contracts --output /dev/null
node gridex-web/scripts/check-mobile-http.mjs http://127.0.0.1:3100 "$RUNNER_TEMP/mobile-http.json"
node scripts/mobile-ops-fixtures.mjs "$RUNNER_TEMP/mobile-fixtures" --refresh
node scripts/mobile-ops-customer-acceptance.mjs "$RUNNER_TEMP/mobile-fixtures/customers.json" "$RUNNER_TEMP/mobile-acceptance.json"
node gridex-web/scripts/mobile-integration/http-features.mjs "$RUNNER_TEMP/mobile-fixtures/customers.json" "$RUNNER_TEMP/mobile-features.json"
kill "$bridge_pid"; wait "$bridge_pid" || true
node scripts/mobile-ops-fixtures.mjs "$RUNNER_TEMP/mobile-fixtures" --refresh
node scripts/mobile-ops-customer-acceptance.mjs "$RUNNER_TEMP/mobile-fixtures/customers.json" --outage
node -e 'const fs=require("node:fs");require("node:https").createServer({key:fs.readFileSync(process.env.RUNNER_TEMP+"/ops.key"),cert:fs.readFileSync(process.env.RUNNER_TEMP+"/ops.crt")},()=>{}).listen(3443,"127.0.0.1")' &
stall_pid=$!; owned_pids+=("$stall_pid")
node gridex-web/scripts/mobile-integration/http-timeout.mjs "$RUNNER_TEMP/mobile-fixtures/customers.json" "$RUNNER_TEMP/mobile-resilience.json"
kill "$stall_pid"; wait "$stall_pid" || true
start_bridge
node scripts/mobile-ops-fixtures.mjs "$RUNNER_TEMP/mobile-fixtures" --refresh
node scripts/mobile-ops-customer-acceptance.mjs "$RUNNER_TEMP/mobile-fixtures/customers.json"
export GRIDEX_QUALIFICATION_CONTROL_KEY="$(openssl rand -hex 32)"
node gridex-web/scripts/mobile-integration/device-gateway.mjs &
owned_pids+=("$!")
curl -fsSL --retry 3 https://github.com/cloudflare/cloudflared/releases/download/2026.10.7/cloudflared-linux-amd64 -o "$RUNNER_TEMP/gridex-cloudflared"
printf '%s  %s\n' 1f99fb518b83dec2ba8d870a7cc991d82a77e6196295a3d2754ba17ab9f91872 "$RUNNER_TEMP/gridex-cloudflared" | sha256sum -c -
chmod 700 "$RUNNER_TEMP/gridex-cloudflared"
"$RUNNER_TEMP/gridex-cloudflared" tunnel --no-autoupdate --protocol http2 --url http://127.0.0.1:3445 > "$RUNNER_TEMP/gridex-tunnel.log" 2>&1 &
owned_pids+=("$!")
healthy=false
for attempt in $(seq 1 90); do
  GRIDEX_DEVICE_PUBLIC_ORIGIN="$(sed -n 's/.*\(https:\/\/[a-z0-9-]*\.trycloudflare\.com\).*/\1/p' "$RUNNER_TEMP/gridex-tunnel.log" | head -1)"
  if test -n "$GRIDEX_DEVICE_PUBLIC_ORIGIN" && curl --fail --silent --max-time 3 "$GRIDEX_DEVICE_PUBLIC_ORIGIN/qualification-health" > "$RUNNER_TEMP/mobile-health.txt" && grep -Fxq synthetic-test-stack "$RUNNER_TEMP/mobile-health.txt"; then healthy=true; break; fi
  sleep 2
done
export GRIDEX_DEVICE_PUBLIC_ORIGIN
test "$healthy" = true
node gridex-web/scripts/mobile-integration/fixtures.mjs "$RUNNER_TEMP/mobile-fixtures/customers.json" --document-origin
kill "$web_pid"; wait "$web_pid" || true
node gridex-web/scripts/mobile-integration/wait-port.mjs 3100 closed
start_web
curl --silent --retry 20 --retry-connrefused --retry-delay 3 --max-time 60 http://127.0.0.1:3100/api/mobile/customer/contracts --output /dev/null
node gridex-web/scripts/mobile-integration/http-document-links.mjs "$RUNNER_TEMP/mobile-fixtures/customers.json"
node gridex-web/scripts/mobile-integration/await-artifact.mjs ios-device-public-key "$RUNNER_TEMP/ios-public-key"
node gridex-web/scripts/mobile-integration/device-fixture.mjs encrypt "$RUNNER_TEMP/mobile-fixtures/customers.json" "$RUNNER_TEMP/ios-encrypted-fixture"
umask 077
for variable in DB_URL NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY GRIDEX_OPS_COMMIT GRIDEX_WEB_COMMIT GRIDEX_DEVICE_PUBLIC_ORIGIN GITHUB_SHA; do
  printf 'export %s=%q\n' "$variable" "${!variable}"
done > "$RUNNER_TEMP/mobile-runtime.env"
touch "$RUNNER_TEMP/mobile-backend.ready"
while ! test -f "$RUNNER_TEMP/mobile-backend.stop"; do sleep 2; done
