"""Local-only regression: an expiring global grant cannot survive lock waiting.

Run after all candidate fixtures/migrations. The local harness first restores
the old transaction-clock behavior to reproduce RED, then restores the exact
candidate function and verifies GREEN. --expect-bug is its child-process mode.
Every candidate operation is explicitly rolled back even in the RED scenario.
"""
import argparse
import json
import os
import subprocess
import sys
import time

options = argparse.ArgumentParser()
options.add_argument("--expect-bug", action="store_true")
arguments = options.parse_args()
if os.environ.get("PGHOST") != "127.0.0.1" or not os.environ.get("PGPORT", "").isdigit():
    raise SystemExit("Explicit local PGHOST=127.0.0.1 and numeric PGPORT are required")
database = os.environ.get("PGDATABASE", "")
if database != "gridex_pricing_security_20261002" and not database.startswith("gridex_web_timed_"):
    raise SystemExit("Use the exact combined native database or an isolated gridex_web_timed_ database")
base = ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-d", database]
actor = "md5('timed-native-actor')::uuid"
target = "md5('timed-native-target')::uuid"
agreement = "md5('pdf-agreement')::uuid"
rows = """'[{"price_area":"SE1","avg_spot_ore":-1.001},
{"price_area":"SE2","avg_spot_ore":0},{"price_area":"SE3","avg_spot_ore":3.333},
{"price_area":"SE4","avg_spot_ore":4.444}]'::jsonb"""
shared_lock = "pg_catalog.hashtextextended('gridex_web_spot_basis',0)"
override_lock = f"pg_catalog.hashtextextended('gridex_web_global_override:'||{target}::text||':users.write',0)"


def query(sql):
    result = subprocess.run(base + ["-c", sql], text=True, capture_output=True, timeout=15)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


def wait_for(predicate, label):
    deadline = time.monotonic() + 6
    while time.monotonic() < deadline:
        if query(f"select {predicate};") == "t":
            return
        time.sleep(0.02)
    raise AssertionError(f"Timed-grant test did not observe {label}")


def snapshot():
    return json.loads(query(f"""select jsonb_build_object(
      'prices',(select jsonb_agg(to_jsonb(p) order by price_area,year,month) from public.gridex_monthly_spot_prices p),
      'basis',(select jsonb_agg(to_jsonb(c) order by id) from public.gridex_spot_basis_config c),
      'basis_log',(select jsonb_agg(to_jsonb(l) order by id) from public.gridex_spot_basis_publish_log l),
      'permission_audit',(select jsonb_agg(to_jsonb(a) order by id) from public.permission_audit a),
      'agreement',(select to_jsonb(a) from public.contract_agreements a where id={agreement}),
      'agreement_audit',(select jsonb_agg(to_jsonb(a) order by id) from public.contract_agreement_audit a),
      'target_overrides',(select jsonb_agg(to_jsonb(o) order by id) from public.user_permission_overrides o where user_id={target}),
      'target_direct',(select jsonb_agg(to_jsonb(p) order by permission_id) from public.user_permissions p where user_id={target}));"""))


if not arguments.expect_bug:
    # Only the clock source changes for the local RED reproduction. Preserve the
    # inspected candidate signature, body, grants and volatility, and restore its
    # exact definition even when a RED assertion fails. No repository file changes.
    original_definition = query("select pg_get_functiondef('public.gridex_get_user_permission_overrides(uuid,uuid)'::regprocedure);")
    if original_definition.count("clock_timestamp()") != 1:
        raise AssertionError("Expected one captured wall-clock expression in the candidate override helper")
    try:
        query(original_definition.replace("clock_timestamp()", "now()"))
        subprocess.run([sys.executable, "-B", __file__, "--expect-bug"], check=True, timeout=60)
    finally:
        query(original_definition)
    assert query("select pg_get_functiondef('public.gridex_get_user_permission_overrides(uuid,uuid)'::regprocedure);") == original_definition


query(f"""insert into auth.users(id,email) values
  ({actor},'timed-actor@invalid.example'),({target},'timed-target@invalid.example');
  insert into public.user_profiles(id,user_id,user_status) values({actor},{actor},'active');""")
operations = [
    ("monthly-save", "spot.write", f"select pg_advisory_xact_lock({shared_lock});",
     f"select public.gridex_web_save_monthly_spot_prices({actor},2026,8,{rows});"),
    ("monthly-publish", "spot.publish", f"select pg_advisory_xact_lock({shared_lock});",
     f"select public.gridex_web_publish_spot_basis({actor},2026,8,'timed-native-publish');"),
    ("monthly-rollback", "spot.publish", f"select pg_advisory_xact_lock({shared_lock});",
     f"select public.gridex_web_rollback_spot_basis({actor},'timed-native-rollback');"),
    ("agreement-pdf", "agreements.write", f"select id from public.contract_agreements where id={agreement} for update;",
     f"select public.gridex_web_record_agreement_pdf({actor},{agreement},{agreement}::text||'.pdf');"),
    ("global-override", "rbac.write", f"select pg_advisory_xact_lock({override_lock});",
     f"select public.gridex_web_set_global_permission_override({actor},{target},"
     "(select id from public.permissions where key='users.write'),'allow');"),
]
try:
    for name, permission, lock_sql, invocation in operations:
        holder = None
        waiter = None
        try:
            if name == "monthly-rollback":
                # Behavior suites roll back their history. Seed one disposable
                # valid record matching the actual current config for this case;
                # never rely on another concurrency program's persistent writes.
                query(f"""insert into public.gridex_spot_basis_publish_log(
                  id,action,active_year,active_month,snapshot,reason,created_by)
                  select md5('timed-native-rollback-log')::uuid,'publish',active_year,active_month,
                    jsonb_build_object('previous_year',2026,'previous_month',8,'web_sequence',
                      (select coalesce(max((snapshot->>'web_sequence')::bigint),0)+1
                       from public.gridex_spot_basis_publish_log where snapshot->>'web_sequence' ~ '^[0-9]{{1,18}}$')),
                    'timed-native-fixture',{actor}
                  from public.gridex_spot_basis_config where id=1;""")
            query(f"""delete from public.user_permission_overrides where user_id={actor};
              insert into public.user_permission_overrides(user_id,permission_key,effect,valid_from,valid_to,is_active)
              values({actor},'{permission}','allow',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '2 seconds',true);""")
            assert query(f"select '{permission}'=any(public.gridex_get_user_permissions({actor},null::uuid));") == "t"
            before = snapshot()
            holder_name = f"gridex-timed-holder-{name}"
            waiter_name = f"gridex-timed-waiter-{name}"
            holder = subprocess.Popen(base, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                stderr=subprocess.PIPE, text=True, env=dict(os.environ, PGAPPNAME=holder_name))
            holder.stdin.write(f"begin; {lock_sql}\n")
            holder.stdin.flush()
            wait_for(f"exists(select 1 from pg_stat_activity where application_name='{holder_name}' and state='idle in transaction')", "holder lock")
            waiter = subprocess.Popen(base + ["-c", f"begin; set local role service_role; {invocation} rollback;"],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                env=dict(os.environ, PGAPPNAME=waiter_name))
            wait_for(f"exists(select 1 from pg_stat_activity where application_name='{waiter_name}' and wait_event_type='Lock')", "blocked request")
            wait_for(f"exists(select 1 from public.user_permission_overrides where user_id={actor} and valid_to<clock_timestamp())", "grant expiration")
            _, holder_error = holder.communicate("commit;\n\\q\n", timeout=5)
            assert holder.returncode == 0, holder_error
            _, waiter_error = waiter.communicate(timeout=5)
            if arguments.expect_bug:
                assert waiter.returncode == 0, waiter_error
                print(f"RED {name}: the expired global grant was accepted after actual lock waiting")
            else:
                assert waiter.returncode != 0 and "42501" in waiter_error, waiter_error
                print(f"GREEN {name}: valid at request start, expired while waiting, rejected after lock")
            assert snapshot() == before, f"{name} left partial data or audit changes"
        finally:
            for process in (waiter, holder):
                if process is not None and process.poll() is None:
                    process.kill()
                    process.communicate(timeout=5)
            if name == "monthly-rollback":
                query("delete from public.gridex_spot_basis_publish_log where id=md5('timed-native-rollback-log')::uuid;")
finally:
    query(f"""delete from public.user_permission_overrides where user_id in({actor},{target});
      delete from public.user_permissions where user_id={target};
      delete from public.user_profiles where user_id={actor};
      delete from auth.users where id in({actor},{target});""")
