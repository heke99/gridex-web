#!/usr/bin/env bash
set -eo pipefail
: "${RUNNER_TEMP:?}" "${GRIDEX_OPS_COMMIT:?}" "${QUALIFICATION_WEB_COMMIT:?}"
export GRIDEX_WEB_COMMIT="$QUALIFICATION_WEB_COMMIT" GITHUB_SHA="$GRIDEX_OPS_COMMIT"
unset GRIDEX_REPLAY_DB_URL
cp supabase/config.toml "$RUNNER_TEMP/consumption-config.original"
python3 - <<'PY'
from pathlib import Path
p=Path('supabase/config.toml');s=p.read_text();assert 'jwt_expiry = 3600' in s;p.write_text(s.replace('jwt_expiry = 3600','jwt_expiry = 60'))
PY
# Existing ordinary clean-stack producer, serialized after the pinned OPS gates.
source scripts/gridex-aud-003-clean-replay.sh
owned_pids=()
finish() {
 local result=$?
 trap - EXIT
 for pid in "${owned_pids[@]}"; do kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; done
 for name in stack ops web; do node gridex-web/scripts/mobile-integration/sanitize-evidence.mjs log "$RUNNER_TEMP/consumption-$name.private.log" "$RUNNER_TEMP/consumption-$name.sanitized.log" || true; done
 if test -f "$RUNNER_TEMP/consumption-private-sql-error.log"; then node gridex-web/scripts/mobile-integration/sanitize-evidence.mjs log "$RUNNER_TEMP/consumption-private-sql-error.log" "$RUNNER_TEMP/consumption-sql.sanitized.log" || true; fi
 cp "$RUNNER_TEMP/consumption-config.original" supabase/config.toml
 set +e
 (exit "$result"); cleanup
 remaining="$(docker ps -aq --filter label=com.supabase.cli.project="$(sed -n 's/^project_id = "\([^"]*\)"/\1/p' supabase/config.toml)")"
 if test -n "$remaining"; then result=1; fi
 RESULT="$result" REMAINING="$remaining" node -e 'require("fs").writeFileSync(process.env.RUNNER_TEMP+"/consumption-cleanup.json",JSON.stringify({completed:true,exitCode:Number(process.env.RESULT),ownedDatabaseContainersRemain:Boolean(process.env.REMAINING)}))'
 rm -rf "$RUNNER_TEMP/mobile-fixtures"
 rm -f "$RUNNER_TEMP/ops.key" "$RUNNER_TEMP/ops.crt" "$RUNNER_TEMP/mobile-runtime.env"
 exit "$result"
}
trap finish EXIT
export DB_URL
status="$(supabase status -o json)"
export NEXT_PUBLIC_SUPABASE_URL="$(jq -er .API_URL <<< "$status")"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$(jq -er .ANON_KEY <<< "$status")"
export SUPABASE_SERVICE_ROLE_KEY="$(jq -er .SERVICE_ROLE_KEY <<< "$status")"
node scripts/mobile-ops-fixtures.mjs "$RUNNER_TEMP/mobile-fixtures"
node gridex-web/scripts/mobile-integration/fixtures.mjs "$RUNNER_TEMP/mobile-fixtures/customers.json"
node gridex-web/scripts/consumption-integration/consumption-fixtures.mjs "$RUNNER_TEMP/mobile-fixtures/customers.json"
export GRIDEX_PORTAL_IDENTITY_ENFORCEMENT=enforce
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=localhost -addext subjectAltName=IP:127.0.0.1 -keyout "$RUNNER_TEMP/ops.key" -out "$RUNNER_TEMP/ops.crt" 2>/dev/null
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3101 > "$RUNNER_TEMP/consumption-ops.private.log" 2>&1 &
owned_pids+=("$!")
start_bridge(){ node scripts/mobile-e2e-ops-https.mjs "$RUNNER_TEMP/ops.key" "$RUNNER_TEMP/ops.crt" & bridge_pid=$!; owned_pids+=("$bridge_pid"); }
start_bridge
curl --fail --silent --retry 20 --retry-all-errors --retry-delay 3 --max-time 30 --cacert "$RUNNER_TEMP/ops.crt" https://127.0.0.1:3443/api/v1/openapi/customer-consumption-v1.json --output /dev/null
# Compile both read boundaries before the customer's bounded 15-second read budget starts.
for resource in sites metering-values; do curl --silent --max-time 60 --cacert "$RUNNER_TEMP/ops.crt" "https://127.0.0.1:3443/api/v1/customer/consumption/$resource" --output /dev/null; done
(
 cd gridex-web
 source "$RUNNER_TEMP/mobile-fixtures/web.env"
 export NODE_EXTRA_CA_CERTS="$RUNNER_TEMP/ops.crt" GRIDEX_OPS_API_URL=https://127.0.0.1:3443/api/v1 GRIDEX_OPS_STAGING_ALLOWED_ORIGINS=https://127.0.0.1:3443 GRIDEX_MOBILE_API_ENABLED=true
 exec node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100
) > "$RUNNER_TEMP/consumption-web.private.log" 2>&1 &
owned_pids+=("$!")
curl --silent --retry 20 --retry-connrefused --retry-delay 3 --max-time 60 http://127.0.0.1:3100/api/mobile/customer/consumption --output /dev/null
node gridex-web/scripts/consumption-integration/consumption-http.mjs "$RUNNER_TEMP/mobile-fixtures/customers.json" "$RUNNER_TEMP/consumption-http.json"
kill "$bridge_pid"; wait "$bridge_pid" || true
node gridex-web/scripts/consumption-integration/consumption-http.mjs "$RUNNER_TEMP/mobile-fixtures/customers.json" "$RUNNER_TEMP/consumption-outage.json" outage
start_bridge
node gridex-web/scripts/consumption-integration/consumption-http.mjs "$RUNNER_TEMP/mobile-fixtures/customers.json" "$RUNNER_TEMP/consumption-recovery.json" recovery
export GRIDEX_QUALIFICATION_CONTROL_KEY="$(openssl rand -hex 32)"
node gridex-web/scripts/consumption-integration/consumption-gateway.mjs &
owned_pids+=("$!")
curl -fsSL --retry 3 https://github.com/cloudflare/cloudflared/releases/download/2026.10.7/cloudflared-linux-amd64 -o "$RUNNER_TEMP/consumption-cloudflared"
printf '%s  %s\n' 1f99fb518b83dec2ba8d870a7cc991d82a77e6196295a3d2754ba17ab9f91872 "$RUNNER_TEMP/consumption-cloudflared" | sha256sum -c -
chmod 700 "$RUNNER_TEMP/consumption-cloudflared"
"$RUNNER_TEMP/consumption-cloudflared" tunnel --no-autoupdate --protocol http2 --url http://127.0.0.1:3445 > "$RUNNER_TEMP/consumption-tunnel.private.log" 2>&1 &
owned_pids+=("$!")
healthy=false
for attempt in $(seq 1 90); do
 GRIDEX_DEVICE_PUBLIC_ORIGIN="$(sed -n 's/.*\(https:\/\/[a-z0-9-]*\.trycloudflare\.com\).*/\1/p' "$RUNNER_TEMP/consumption-tunnel.private.log" | head -1)"
 if test -n "$GRIDEX_DEVICE_PUBLIC_ORIGIN" && curl --fail --silent --max-time 3 "$GRIDEX_DEVICE_PUBLIC_ORIGIN/qualification-health" | grep -Fxq synthetic-consumption-stack; then healthy=true; break; fi
 sleep 2
done
export GRIDEX_DEVICE_PUBLIC_ORIGIN
test "$healthy" = true
node gridex-web/scripts/mobile-integration/await-artifact.mjs ios-device-public-key "$RUNNER_TEMP/ios-public-key"
node gridex-web/scripts/mobile-integration/device-fixture.mjs encrypt "$RUNNER_TEMP/mobile-fixtures/customers.json" "$RUNNER_TEMP/ios-encrypted-fixture"
umask 077
for variable in DB_URL NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY GRIDEX_OPS_COMMIT GRIDEX_WEB_COMMIT GRIDEX_DEVICE_PUBLIC_ORIGIN GITHUB_SHA GRIDEX_QUALIFICATION_CONTROL_KEY; do printf 'export %s=%q\n' "$variable" "${!variable}"; done > "$RUNNER_TEMP/mobile-runtime.env"
touch "$RUNNER_TEMP/consumption-backend.ready"
while ! test -f "$RUNNER_TEMP/consumption-backend.stop"; do sleep 2; done
