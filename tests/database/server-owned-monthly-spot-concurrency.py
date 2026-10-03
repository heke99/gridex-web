"""Native local-only proof: authorization must be refreshed after the shared lock.

Load the independent-Web and monthly fixtures + candidate migration first.
PGHOST must explicitly be 127.0.0.1. PGDATABASE must start gridex_web_monthly
or be the exact combined native fixture gridex_pricing_security_20261002.
This script never accepts a URL and never mutates a remote database.
"""
import json
import os
import subprocess
import time

if os.environ.get("PGHOST") != "127.0.0.1" or not os.environ.get("PGPORT", "").isdigit():
    raise SystemExit("Explicit local PGHOST=127.0.0.1 and PGPORT are required")
DATABASE = os.environ.get("PGDATABASE", "")
if not (DATABASE.startswith("gridex_web_monthly") or DATABASE == "gridex_pricing_security_20261002"):
    raise SystemExit("Use a disposable local monthly or exact combined native fixture database")
BASE = ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-d", DATABASE]
WRITER = "md5('monthly-global-writer')::uuid"
PUBLISHER = "md5('monthly-global-publisher')::uuid"
LOCK = "pg_catalog.hashtextextended('gridex_web_spot_basis',0)"
ROWS = """'[{"price_area":"SE1","avg_spot_ore":-1.001},
 {"price_area":"SE2","avg_spot_ore":0},{"price_area":"SE3","avg_spot_ore":3.333},
 {"price_area":"SE4","avg_spot_ore":4.444}]'::jsonb"""


def query(sql, check=True):
    result = subprocess.run(BASE + ["-c", sql], text=True, capture_output=True, timeout=15)
    if check and result.returncode:
        raise RuntimeError(result.stderr)
    return result


def snapshot():
    return query("""select jsonb_build_object(
      'prices',(select jsonb_agg(to_jsonb(p) order by price_area,year,month) from public.gridex_monthly_spot_prices p),
      'config',(select jsonb_agg(to_jsonb(c) order by id) from public.gridex_spot_basis_config c),
      'history',(select jsonb_agg(to_jsonb(l) order by id) from public.gridex_spot_basis_publish_log l),
      'audit',(select jsonb_agg(to_jsonb(a) order by id) from public.permission_audit a));""").stdout.strip()


def await_lock(application_name, granted):
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        count = query(f"""select count(*) from pg_locks l join pg_stat_activity a on a.pid=l.pid
          where a.application_name='{application_name}' and l.locktype='advisory'
            and l.granted={'true' if granted else 'false'};""").stdout.strip()
        if count != "0":
            return
        time.sleep(0.02)
    raise AssertionError(f"{application_name} did not {'hold' if granted else 'wait for'} shared basis lock")


original = json.loads(query("select to_jsonb(c) from public.gridex_spot_basis_config c where id=1;").stdout.strip())
assert query("select count(*) from public.gridex_monthly_spot_prices where year=2099 and month in(1,2);").stdout.strip() == "0", "Reserved local test periods already exist"
query(f"""set role service_role;
  select public.gridex_web_save_monthly_spot_prices({WRITER},2099,1,{ROWS});
  select public.gridex_web_save_monthly_spot_prices({WRITER},2099,2,{ROWS});
  select public.gridex_web_publish_spot_basis({PUBLISHER},2099,2,'monthly-concurrency-setup');""")
operations = [
    ("save", WRITER, f"select public.gridex_web_save_monthly_spot_prices({WRITER},2099,1,jsonb_set({ROWS},'{{0,avg_spot_ore}}','77.777'));"),
    ("publish", PUBLISHER, f"select public.gridex_web_publish_spot_basis({PUBLISHER},2099,1,'monthly-concurrency-forbidden');"),
    ("rollback", PUBLISHER, f"select public.gridex_web_rollback_spot_basis({PUBLISHER},'monthly-concurrency-forbidden');"),
]
try:
    for operation, actor, invocation in operations:
        holder = None
        waiter = None
        before = snapshot()
        holder_name = f"gridex-monthly-holder-{operation}"
        waiter_name = f"gridex-monthly-waiter-{operation}"
        try:
            holder = subprocess.Popen(BASE, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                stderr=subprocess.PIPE, text=True, env=dict(os.environ, PGAPPNAME=holder_name))
            holder.stdin.write(f"begin; select pg_advisory_xact_lock({LOCK});\n")
            holder.stdin.flush()
            await_lock(holder_name, True)
            waiter = subprocess.Popen(BASE + ["-c", f"set role service_role; {invocation}"],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                env=dict(os.environ, PGAPPNAME=waiter_name))
            await_lock(waiter_name, False)
            # This commits while the request is blocked. A permission read made
            # before the wait would incorrectly accept a now-revoked actor.
            query(f"update public.user_roles set is_active=false,status='disabled' where user_id={actor} and company_id is null;")
            _, holder_error = holder.communicate("commit;\n\\q\n", timeout=5)
            assert holder.returncode == 0, holder_error
            _, waiter_error = waiter.communicate(timeout=5)
            assert waiter.returncode != 0 and "42501" in waiter_error, waiter_error
            assert snapshot() == before, f"Waiting {operation} changed data after actor was revoked"
            print(f"{operation}: shared lock observed; actor revoked during wait; fresh permission rejected; data/audit unchanged")
        finally:
            for process in (waiter, holder):
                if process is not None and process.poll() is None:
                    process.kill()
                    process.communicate(timeout=5)
            query(f"update public.user_roles set is_active=true,status='active' where user_id={actor} and company_id is null;")
finally:
    query(f"""delete from public.gridex_spot_basis_publish_log where reason in('monthly-concurrency-setup','monthly-concurrency-forbidden');
      delete from public.permission_audit where action='spot.monthly_prices.upsert'
        and metadata->>'year'='2099' and metadata->>'month' in('1','2');
      delete from public.gridex_monthly_spot_prices where year=2099 and month in(1,2);
      update public.gridex_spot_basis_config set active_year={original['active_year']},
        active_month={original['active_month']},updated_by={"null" if original['updated_by'] is None else "'" + original['updated_by'] + "'::uuid"} where id=1;""")
