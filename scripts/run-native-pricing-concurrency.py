"""Three real multi-session atomic pricing regressions; disposable database only."""

import importlib.util
import json
from pathlib import Path
import subprocess
import time


spec = importlib.util.spec_from_file_location("native_common", Path(__file__).with_name("native-database-common.py"))
common = importlib.util.module_from_spec(spec)
spec.loader.exec_module(common)
PSQL, ENV, MAJOR = common.connection()


def query(sql, name="pricing_test_control"):
    return common.query(PSQL, ENV, sql, name)


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


ACTOR = "ccd10000-0000-4000-8000-000000000001"


def publish(contract, version, reason):
    return f"select public.gridex_web_publish_pricing('{contract}','{version}','{ACTOR}','{reason}');"


def save(version, markup):
    return f"select public.gridex_web_save_draft_pricing('{version}',public.gridex_pricing_native_test_rows({markup}));"


def scenario(a_sql, b_sql, expect_failure=False):
    processes = []
    try:
        a = start("begin; set local role service_role; " + a_sql + " select pg_sleep(2); commit;", "pricing_test_A")
        processes.append(a)
        wait_for("pricing_test_A", "wait_event='PgSleep'")
        b = start("set statement_timeout='10s'; set role service_role; " + b_sql, "pricing_test_B")
        processes.append(b)
        wait_for("pricing_test_B", "wait_event_type='Lock'")
        _, a_err = a.communicate(timeout=10)
        _, b_err = b.communicate(timeout=10)
        assert a.returncode == 0, a_err
        if expect_failure:
            assert b.returncode != 0 and "55000" in b_err and "Published pricing is immutable" in b_err, b_err
        else:
            assert b.returncode == 0, b_err
    finally:
        for process in processes:
            if process.poll() is None:
                process.terminate()
                process.communicate(timeout=5)


C1 = "ccd30000-0000-4000-8000-000000000001"
C2 = "ccd30000-0000-4000-8000-000000000002"
C3 = "ccd30000-0000-4000-8000-000000000003"
V1 = "ccd40000-0000-4000-8000-000000000011"
V2 = "ccd40000-0000-4000-8000-000000000021"
V31 = "ccd40000-0000-4000-8000-000000000031"
V32 = "ccd40000-0000-4000-8000-000000000032"

scenario(publish(C1, V1, "Native publish-before-save"), save(V1, 99), expect_failure=True)
assert query(f"select is_published and status='published' and (select min(markup_ore)=8 and max(markup_ore)=8 from public.contract_area_pricing where pricing_version_id='{V1}') from public.contract_pricing_versions where id='{V1}'") == "t"
scenario(save(V2, 12), publish(C2, V2, "Native save-before-publish"))
assert query(f"select is_published and status='published' and (select count(*)=4 and min(markup_ore)=12 and max(markup_ore)=12 from public.contract_area_pricing where pricing_version_id='{V2}') from public.contract_pricing_versions where id='{V2}'") == "t"
scenario(publish(C3, V31, "Native publisher A"), publish(C3, V32, "Native publisher B"))
assert query(f"select count(*)=1 and min(id::text)='{V32}' from public.contract_pricing_versions where contract_id='{C3}' and is_published") == "t"
assert query(f"select count(*)=2 from public.pricing_version_audit where contract_id='{C3}' and action='publish'") == "t"
print(json.dumps({
    "concurrent_publish_then_save": "blocked; immutable draft write rejected",
    "concurrent_save_then_publish": "blocked; saved four areas published",
    "concurrent_publishers": "serialized; one active version and two audits",
    "postgres_major": int(MAJOR),
}))
