"""Connection restrictions shared by the disposable native database runners."""

import os
import shutil
import subprocess


DATABASE = "gridex_pricing_security_20261002"


def connection():
    required = {
        "GRIDEX_NATIVE_DATABASE_TEST": "1",
        "PGHOST": "127.0.0.1",
        "PGPORT": "55432",
        "PGDATABASE": DATABASE,
    }
    for key, expected in required.items():
        if os.environ.get(key) != expected:
            raise SystemExit(f"Native fixtures require explicit {key}={expected}")
    user = os.environ.get("PGUSER")
    if not user:
        raise SystemExit("Native fixtures require explicit PGUSER")
    executable = shutil.which("psql")
    if executable is None:
        raise SystemExit("psql must be installed before running native fixtures")
    env = dict(os.environ)
    # Neither a libpq service nor a hostaddr may redirect the loopback guard.
    for key in ("PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE", "PGOPTIONS"):
        env.pop(key, None)
    env["PGCONNECT_TIMEOUT"] = "5"
    env["PGOPTIONS"] = "-c statement_timeout=15000 -c lock_timeout=10000"
    args = [
        executable, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
        "-v", "VERBOSITY=verbose", "-h", "127.0.0.1", "-p", "55432",
        "-U", user, "-d", DATABASE,
    ]
    result = subprocess.run(
        args + ["-c", "select current_database(),current_setting('server_version_num')::int/10000,"
                "current_setting('server_version');"],
        env=env, text=True, capture_output=True, timeout=10, check=True,
    )
    values = result.stdout.strip().split("|")
    # The socket destination above is loopback; a Docker service reports its
    # internal address/5432 rather than the runner's mapped loopback/55432.
    if len(values) != 3 or values[0] != DATABASE or values[1] not in ("16", "17"):
        raise SystemExit("Expected the disposable PostgreSQL 16/17 database on 127.0.0.1:55432")
    expected_version = env.get("GRIDEX_NATIVE_POSTGRES_VERSION")
    if expected_version and values[2].split()[0] != expected_version:
        raise SystemExit(f"Native database server does not match PostgreSQL {expected_version}")
    return args, env, values[1]


def query(args, env, sql, name="gridex_native_control"):
    result = subprocess.run(
        args + ["-c", sql], env={**env, "PGAPPNAME": name}, text=True,
        capture_output=True, timeout=30,
    )
    if result.returncode:
        raise AssertionError(result.stderr)
    return result.stdout.strip()
