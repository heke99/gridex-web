"""Real post-lock permission-revocation proof; disposable native database only."""

import importlib.util
import json
from pathlib import Path
import subprocess
import time


spec = importlib.util.spec_from_file_location(
    "native_common", Path(__file__).resolve().parents[2] / "scripts/native-database-common.py"
)
common = importlib.util.module_from_spec(spec)
spec.loader.exec_module(common)
PSQL, ENV, MAJOR = common.connection()


def query(sql):
    return common.query(PSQL, ENV, sql, "agreement_pdf_control")


def start(sql, name):
    return subprocess.Popen(
        PSQL + ["-c", sql], env={**ENV, "PGAPPNAME": name}, text=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )


def wait_for(name, predicate):
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        if query(f"select exists(select 1 from pg_stat_activity where application_name='{name}' and {predicate})") == "t":
            return
        time.sleep(0.02)
    raise AssertionError(f"{name} did not reach {predicate}")


ACTOR = "md5('pdf-writer')::uuid"
AGREEMENT = "md5('pdf-agreement')::uuid"
snapshot_sql = (
    f"select jsonb_build_object('agreement',to_jsonb(a),'audits',"
    f"(select jsonb_agg(to_jsonb(h) order by h.id) from public.contract_agreement_audit h "
    f"where h.agreement_id={AGREEMENT})) from public.contract_agreements a where a.id={AGREEMENT};"
)
before = query(snapshot_sql)
assert query(f"select coalesce(bool_and(is_active),false) from public.user_roles where user_id={ACTOR};") == "t"
assert query(f"select 'agreements.write'=any(public.gridex_get_user_permissions({ACTOR},null::uuid));") == "t"
processes = []
try:
    blocker = start(
        f"begin; select id from public.contract_agreements where id={AGREEMENT} for update; "
        "select pg_sleep(3); commit;", "agreement_pdf_blocker"
    )
    processes.append(blocker)
    wait_for("agreement_pdf_blocker", "wait_event='PgSleep'")
    writer = start(
        f"set role service_role; select public.gridex_web_record_agreement_pdf("
        f"{ACTOR},{AGREEMENT},{AGREEMENT}::text||'.pdf');", "agreement_pdf_waiter"
    )
    processes.append(writer)
    wait_for("agreement_pdf_waiter", "wait_event_type='Lock'")
    # This commit is independent of the agreement lock. The function must read
    # the new grant state after its lock wait, not rely on the Web page's grant.
    query(f"update public.user_roles set is_active=false where user_id={ACTOR};")
    _, blocker_error = blocker.communicate(timeout=10)
    _, writer_error = writer.communicate(timeout=10)
    assert blocker.returncode == 0, blocker_error
    assert writer.returncode != 0 and "42501" in writer_error and "Global agreements.write is required" in writer_error, writer_error
    assert query(snapshot_sql) == before, "A permission revoked during lock wait left partial PDF/audit state"
    print(json.dumps({
        "post_lock_global_permission_revocation": "denied",
        "agreement_metadata_and_audit": "unchanged",
        "postgres_major": int(MAJOR),
    }))
finally:
    for process in processes:
        if process.poll() is None:
            process.terminate()
            process.communicate(timeout=5)
    query(f"update public.user_roles set is_active=true where user_id={ACTOR};")
