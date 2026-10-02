"""Concurrent public-contact idempotency proof; disposable database only."""

from concurrent.futures import ThreadPoolExecutor
import importlib.util
import json
from pathlib import Path
from threading import Barrier


spec = importlib.util.spec_from_file_location("native_common", Path(__file__).with_name("native-database-common.py"))
common = importlib.util.module_from_spec(spec)
spec.loader.exec_module(common)
PSQL, ENV, MAJOR = common.connection()
CLIENT_ID = "public:cce10000-0000-4000-8000-000000000001"
BARRIER = Barrier(12, timeout=10)


def query(sql):
    return common.query(PSQL, ENV, sql)


def create_contact(_):
    BARRIER.wait()
    return query("set role service_role; select public.gridex_create_public_support_contact("
                 "'cce10000-0000-4000-8000-000000000001','Concurrent fixture',"
                 "'concurrent-support@invalid.example','','general',"
                 "'Concurrent support fixture','Concurrent support body',null);")


assert query(f"select count(*) from public.customer_support_tickets where client_request_id='{CLIENT_ID}';") == "0"
try:
    with ThreadPoolExecutor(max_workers=12) as executor:
        results = list(executor.map(create_contact, range(12)))
    assert len(results) == 12 and len(set(results)) == 1, results
    assert query(f"select count(*) from public.customer_support_tickets where client_request_id='{CLIENT_ID}';") == "1"
    assert query(f"select count(*) from public.customer_support_messages where client_request_id='{CLIENT_ID}:initial-message';") == "1"
    print(json.dumps({"concurrent_identical_contacts": 12, "tickets": 1,
                      "initial_messages": 1, "returned_ticket_ids": 1,
                      "postgres_major": int(MAJOR)}))
finally:
    query(f"delete from public.customer_support_messages where client_request_id='{CLIENT_ID}:initial-message';"
          f"delete from public.customer_support_tickets where client_request_id='{CLIENT_ID}';")
