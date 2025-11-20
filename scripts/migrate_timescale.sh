#!/usr/bin/env bash
set -euo pipefail

DSN=${OHLC_DB_URL:-postgres://postgres:devpass@localhost:54329/ohlc_store}

parse_output=$(DSN_INPUT="$DSN" python3 - <<'PY'
import os
import sys
from urllib.parse import urlparse

dsn = os.environ.get('DSN_INPUT')
if not dsn:
    sys.exit(1)
parts = urlparse(dsn)
user = parts.username or ''
password = parts.password or ''
host = parts.hostname or 'localhost'
port = parts.port or 5432
database = (parts.path or '/').lstrip('/') or 'postgres'
print(f"{user}:{password}:{host}:{port}:{database}")
PY
)

if [[ -z "$parse_output" ]]; then
  echo "Failed to parse OHLC DB DSN" >&2
  exit 1
fi

IFS=':' read -r PGUSER PGPASS PGHOST PGPORT PGDATABASE <<<"$parse_output"

echo "Target Timescale DSN: $DSN"
printf 'Using database: [%s]\n' "$PGDATABASE"

USE_DOCKER_PSQL=0

if command -v psql >/dev/null 2>&1; then
  echo "Using host psql client"
  run_psql() {
    PGPASSWORD="$PGPASS" psql "$DSN" "$@"
  }
  run_sql_file() {
    PGPASSWORD="$PGPASS" psql "$DSN" -v ON_ERROR_STOP=1 -f "$1"
  }
else
  echo "psql not found locally; executing via the ohlc-db container"
  USE_DOCKER_PSQL=1
  DOCKER_CMD=(docker exec -e PGPASSWORD="$PGPASS" -i ohlc-db psql -h localhost -p 5432 -U "$PGUSER" -d "$PGDATABASE")
  run_psql() {
    "${DOCKER_CMD[@]}" "$@"
  }
  run_sql_file() {
    cat "$1" | "${DOCKER_CMD[@]}" -v ON_ERROR_STOP=1
  }
fi

echo "==> Ensuring extensions are installed"
run_psql <<'SQL'
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS timescaledb_toolkit;
SQL

shopt -s nullglob
for f in db/timescale-migrations/*.sql; do
  echo "==> Applying $f"
  run_sql_file "$f"
done
