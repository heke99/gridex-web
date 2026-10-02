"""Local-only native concurrency proof; never point this at a remote database."""
import os
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor

if os.environ.get("PGHOST") != "127.0.0.1" or os.environ.get("PGPORT") != "55432":
    raise SystemExit("Explicit local PGHOST=127.0.0.1 PGPORT=55432 is required")
DATABASE = os.environ.get("PGDATABASE", "gridex_web_rbac_acl_final_20261002")
BASE = ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-d", DATABASE]


def query(sql, check=True):
    result = subprocess.run(BASE + ["-c", sql], text=True, capture_output=True)
    if check and result.returncode:
        raise RuntimeError(result.stderr)
    return result


ACTOR = "md5('override-concurrent-actor')::uuid"
TARGET = "md5('override-concurrent-target')::uuid"
COMPANY = "md5('override-concurrent-company')::uuid"
PERMISSION = "(select id from public.permissions where key='users.write')"
LOCK = f"pg_catalog.hashtextextended('gridex_web_global_override:' || {TARGET}::text || ':users.write',0)"
SETUP = f"""
insert into auth.users(id,email) values
 ({ACTOR},'override-concurrent-actor@invalid.example'),
 ({TARGET},'override-concurrent-target@invalid.example');
insert into public.user_profiles(id,user_id,user_status) values
 ({ACTOR},{ACTOR},'active'),({TARGET},{TARGET},'active');
insert into public.user_roles(id,user_id,role,role_id,company_id,status,is_active)
 select md5('override-concurrent-assignment')::uuid,{ACTOR},'super_admin',id,null,'active',true
 from public.roles where key='super_admin';
insert into public.companies(id,name) values({COMPANY},'Concurrent override fixture company');
insert into public.user_permissions(user_id,permission_id,permission_key,company_id,effect,status,is_active)
 values({TARGET},{PERMISSION},'users.write',{COMPANY},'allow','active',true);
insert into public.user_permission_overrides(id,user_id,permission_key,company_id,effect,is_active)
 values(md5('override-concurrent-company-override')::uuid,{TARGET},'users.write',{COMPANY},'allow',true);
"""
CLEANUP = f"""
delete from public.user_permission_overrides where user_id={TARGET};
delete from public.user_permissions where user_id={TARGET};
delete from public.user_roles where user_id={ACTOR};
delete from public.companies where id={COMPANY};
delete from public.user_profiles where user_id in({ACTOR},{TARGET});
delete from auth.users where id in({ACTOR},{TARGET});
"""


def scoped_snapshot():
    return query(f"""select jsonb_build_object(
      'direct',(select jsonb_agg(to_jsonb(u)) from public.user_permissions u
                where user_id={TARGET} and company_id is not null),
      'override',(select jsonb_agg(to_jsonb(o)) from public.user_permission_overrides o
                  where user_id={TARGET} and company_id is not null));""").stdout.strip()


def invoke(effect):
    return query(f"set role service_role; select public.gridex_web_set_global_permission_override({ACTOR},{TARGET},{PERMISSION},'{effect}');")


query(SETUP)
try:
    initial = scoped_snapshot()
    with ThreadPoolExecutor(max_workers=12) as pool:
        results = list(pool.map(invoke, ["allow", "deny"] * 6))
    assert len(results) == 12
    assert query(f"select count(*) from public.user_permission_overrides where user_id={TARGET} and company_id is null and is_active;").stdout.strip() == "1"
    assert query(f"select count(*) from public.user_permission_overrides where user_id={TARGET} and company_id is null;").stdout.strip() == "12"
    assert scoped_snapshot() == initial
    print("12 concurrent global decisions serialized to one active record; all scoped rows unchanged")

    # Hold the same logical target lock, start a setter that waits, then revoke
    # the actor. Authorization must be checked after the lock wait completes.
    holder = subprocess.Popen(BASE + ["-c", f"begin; select pg_advisory_xact_lock({LOCK}); select pg_sleep(1.5); commit;"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    for _ in range(100):
        if query("select count(*) from pg_locks where locktype='advisory' and granted and pid<>pg_backend_pid();").stdout.strip() != "0":
            break
        time.sleep(0.01)
    else:
        raise AssertionError("Holder never acquired target lock")
    waiter = subprocess.Popen(BASE + ["-c", f"set role service_role; select public.gridex_web_set_global_permission_override({ACTOR},{TARGET},{PERMISSION},'allow');"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    for _ in range(100):
        if query("select count(*) from pg_locks where locktype='advisory' and not granted;").stdout.strip() != "0":
            break
        time.sleep(0.01)
    else:
        raise AssertionError("Setter never waited on target lock")
    query(f"update public.user_roles set is_active=false,status='disabled' where user_id={ACTOR} and company_id is null;")
    _, holder_error = holder.communicate(timeout=5)
    assert holder.returncode == 0, holder_error
    _, waiter_error = waiter.communicate(timeout=5)
    assert waiter.returncode != 0 and "Global rbac.write is required" in waiter_error, waiter_error
    assert query(f"select count(*) from public.user_permission_overrides where user_id={TARGET} and company_id is null;").stdout.strip() == "12"
    assert scoped_snapshot() == initial
    print("Waiting setter rechecked current actor permissions after lock and rejected a revoked actor")
finally:
    query(CLEANUP)
