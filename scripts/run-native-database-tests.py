"""Replay the independent Web package into a fresh, explicit disposable database.

Provision an empty gridex_pricing_security_20261002 database on a dedicated local
PostgreSQL 16/17 server, then run with GRIDEX_NATIVE_DATABASE_TEST=1,
PGHOST=127.0.0.1, PGPORT=55432, PGDATABASE=gridex_pricing_security_20261002,
and an explicit PGUSER. The runner never creates, resets or drops a database.
These production-shaped fixtures cover the selected forward package; they are
not a replay of every historical Supabase migration or a production rehearsal.
"""

import importlib.util
import hashlib
import json
from pathlib import Path
import subprocess
import sys


sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("native_common", Path(__file__).with_name("native-database-common.py"))
common = importlib.util.module_from_spec(spec)
spec.loader.exec_module(common)

SETUP = [
    "tests/database/independent-web-fixture.sql",
    "tests/database/independent-web-existing-functions.sql",
    "tests/database/independent-web-function-preflight.sql",
    "supabase/migrations/20261002173716_independent_web_rbac_and_public_support.sql",
    "tests/database/pricing-fixture.sql",
    "supabase/migrations/20261002175651_gridex_web_atomic_pricing.sql",
    "tests/database/server-owned-rbac-fixture.sql",
    "tests/database/server-owned-rbac-before.sql",
    "supabase/migrations/20261002192814_gridex_web_server_owned_rbac.sql",
    "supabase/migrations/20261002192011_gridex_web_global_permission_override.sql",
    "tests/database/server-owned-monthly-spot-fixture.sql",
    "tests/database/server-owned-postal-fixture.sql",
    "tests/database/server-owned-postal-red.sql",
    "supabase/migrations/20261002200715_gridex_web_server_owned_postal_mapping.sql",
    "supabase/migrations/20261002201624_gridex_web_atomic_monthly_spot.sql",
    "tests/database/agreement-pdf-fixture.sql",
    "tests/database/agreement-pdf-red.sql",
    "tests/database/agreement-projection-trigger-fixture.sql",
    "tests/database/agreement-projection-trigger-existing.sql",
    "tests/database/agreement-projection-trigger-red.sql",
    "supabase/migrations/20261002202211_gridex_web_atomic_agreement_pdf.sql",
    "supabase/migrations/20261002202617_gridex_web_agreement_projection_trigger.sql",
    "supabase/migrations/20261003180510_gridex_web_global_rbac_directory.sql",
    "tests/database/webhook-identity-fixture.sql",
    "supabase/migrations/20260819194500_ops_domain_webhook_organization_reference.sql",
    "tests/database/webhook-identity-red.sql",
    "supabase/migrations/20261003175858_gridex_web_stable_webhook_identity.sql",
]
ASSERTIONS = [
    "tests/database/independent-web-function-preflight.sql",
    "tests/database/independent-web-production-assertions.sql",
    "tests/database/pricing-deployment-assertions.sql",
    "tests/database/server-owned-rbac-deployment-assertions.sql",
    "tests/database/server-owned-rbac-overrides-deployment-assertions.sql",
    "tests/database/server-owned-postal-deployment-assertions.sql",
    "tests/database/server-owned-monthly-spot-deployment-assertions.sql",
    "tests/database/agreement-pdf-deployment-assertions.sql",
    "tests/database/agreement-projection-trigger-deployment-assertions.sql",
    "tests/database/global-rbac-directory-deployment-assertions.sql",
]
BEHAVIOR = [
    "tests/database/independent-web-security.sql",
    "tests/database/exact-role-resolution.sql",
    "tests/database/global-rbac-directory.sql",
    "tests/database/atomic-pricing.sql",
    "tests/database/server-owned-rbac.sql",
    "tests/database/server-owned-rbac-overrides.sql",
    "tests/database/server-owned-postal.sql",
    "tests/database/server-owned-monthly-spot.sql",
    "tests/database/agreement-pdf.sql",
    "tests/database/agreement-projection-trigger.sql",
    "tests/database/webhook-identity.sql",
]
CONCURRENCY_SETUP = ["tests/database/pricing-concurrency.sql"]
CONCURRENCY = [
    "scripts/run-native-support-concurrency.py",
    "scripts/run-native-pricing-concurrency.py",
    "tests/database/server-owned-rbac-concurrency.py",
    "tests/database/server-owned-monthly-spot-concurrency.py",
    "tests/database/agreement-pdf-concurrency.py",
    "tests/database/timed-permission-concurrency.py",
]

# The historical webhook function is a pre-change fixture, not part of the
# deployment candidate. Keep its hash in the package evidence separately.
HISTORICAL_SETUP_MIGRATIONS = [
    "supabase/migrations/20260819194500_ops_domain_webhook_organization_reference.sql",
]
CANDIDATE_MIGRATIONS = [relative for relative in SETUP
                        if relative.startswith("supabase/migrations/")
                        and relative not in HISTORICAL_SETUP_MIGRATIONS]
# Read-only production inspection recorded this ACL as already applied. The
# native runner replays it into its empty fixture, but never reapplies it to
# production or discovers live production state. Counts below name that scope.
RECORDED_PRODUCTION_APPLIED_MIGRATIONS = [
    "supabase/migrations/20261002192814_gridex_web_server_owned_rbac.sql",
]
if not set(HISTORICAL_SETUP_MIGRATIONS).issubset(SETUP):
    raise SystemExit("Historical migration classification contains an unselected file")
if not set(RECORDED_PRODUCTION_APPLIED_MIGRATIONS).issubset(CANDIDATE_MIGRATIONS):
    raise SystemExit("Recorded applied migration is not part of the selected candidate")


def sql_file(relative):
    print(f"SQL {relative}", flush=True)
    result = subprocess.run(
        PSQL + ["-f", str(ROOT / relative)], cwd=ROOT, env=ENV, text=True,
        capture_output=True, timeout=120,
    )
    if result.returncode:
        raise RuntimeError(f"Native SQL failed: {relative}\n{result.stdout}\n{result.stderr}")
    if relative.endswith("independent-web-function-preflight.sql") and result.stdout.strip():
        raise AssertionError(f"Incompatible existing RPC signatures:\n{result.stdout}")
    if relative.endswith("pricing-deployment-assertions.sql"):
        values = json.loads(result.stdout.strip())
        for key in (
            "pricing_tables_present_and_rls", "browser_mutations_revoked",
            "service_only_invoker_rpcs", "pricing_policies_select_only",
            "private_permission_helper_authenticated_only",
        ):
            if values.get(key) is not True:
                raise AssertionError(f"Native pricing deployment assertion failed: {key}")
    if result.stdout.strip():
        print(result.stdout.strip(), flush=True)
    if relative.endswith("-red.sql") and result.stderr.strip():
        print(result.stderr.strip(), flush=True)


SELECTED_FILES = sorted(set(SETUP + ASSERTIONS + BEHAVIOR + CONCURRENCY_SETUP + CONCURRENCY + [
    "scripts/native-database-common.py", "scripts/run-native-database-tests.py",
]))
missing = [relative for relative in SELECTED_FILES
           if not (ROOT / relative).is_file()]
if missing:
    raise SystemExit("Native package is incomplete; missing files:\n" + "\n".join(missing))


def file_hashes():
    return {relative: hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()
            for relative in SELECTED_FILES}


HASHES = file_hashes()
PACKAGE_HASH = hashlib.sha256(json.dumps(HASHES, sort_keys=True).encode()).hexdigest()
print(json.dumps({"native_package_sha256": PACKAGE_HASH, "migration_sha256": {
    relative: HASHES[relative] for relative in CANDIDATE_MIGRATIONS
}, "historical_setup_migration_sha256": {
    relative: HASHES[relative] for relative in HISTORICAL_SETUP_MIGRATIONS
}}), flush=True)
PSQL, ENV, MAJOR = common.connection()

if common.query(PSQL, ENV, """select
  exists(select 1 from pg_namespace where nspname not in('public','information_schema') and nspname not like 'pg_%')
  or exists(select 1 from pg_class where relnamespace='public'::regnamespace)
  or exists(select 1 from pg_proc where pronamespace='public'::regnamespace)
  or exists(select 1 from pg_type where typnamespace='public'::regnamespace);""") != "f":
    raise SystemExit("Native fixtures require an empty disposable database; no reset or drop was performed")

for relative in SETUP + ASSERTIONS + BEHAVIOR + CONCURRENCY_SETUP:
    sql_file(relative)
for relative in CONCURRENCY:
    print(f"MULTI-SESSION {relative}", flush=True)
    subprocess.run([sys.executable, "-B", str(ROOT / relative)], cwd=ROOT, env=ENV, check=True, timeout=120)

after = file_hashes()
changed = [relative for relative in SELECTED_FILES if HASHES[relative] != after[relative]]
if changed:
    raise SystemExit("Native candidate changed while tests ran; repeat on a frozen candidate:\n" + "\n".join(changed))

print(json.dumps({
    "native_package_sha256": PACKAGE_HASH,
    "postgres_major": int(MAJOR),
    "forward_migrations": len(CANDIDATE_MIGRATIONS),
    "historical_setup_migrations": len(HISTORICAL_SETUP_MIGRATIONS),
    "recorded_production_applied_candidate_migrations": len(RECORDED_PRODUCTION_APPLIED_MIGRATIONS),
    "recorded_production_pending_candidate_migrations": len(CANDIDATE_MIGRATIONS) - len(RECORDED_PRODUCTION_APPLIED_MIGRATIONS),
    "deployment_assertion_files": len(ASSERTIONS),
    "rollback_behavior_files": len(BEHAVIOR),
    "concurrency_programs": len(CONCURRENCY),
    "result": "selected native package passed",
}), flush=True)
