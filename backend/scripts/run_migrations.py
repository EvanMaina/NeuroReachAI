"""
Run Database Migrations
=======================
Executes all SQL migration files from /app/migrations/ in sorted order.
Tracks applied migrations in a `schema_migrations` table so each file
runs exactly once. All migration files also use IF NOT EXISTS / IF EXISTS
as a safety net, making this doubly idempotent.

Usage (CI/CD pipeline — ECS one-off task):
    python /app/scripts/run_migrations.py

Usage (local development):
    DATABASE_URL=postgresql://... python backend/scripts/run_migrations.py --migrations-dir database/init
"""

import argparse
import os
import re
import sys
import time

import psycopg2


# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
DATABASE_URL = os.environ.get("DATABASE_URL", "")
DEFAULT_MIGRATIONS_DIR = os.path.join(os.path.dirname(__file__), "..", "migrations")


# ---------------------------------------------------------------------------
# SQL helpers
# ---------------------------------------------------------------------------
SCHEMA_MIGRATIONS_DDL = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    id          SERIAL PRIMARY KEY,
    filename    VARCHAR(255) NOT NULL UNIQUE,
    applied_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    checksum    VARCHAR(64),
    success     BOOLEAN NOT NULL DEFAULT TRUE
);
"""


def split_sql_statements(sql: str) -> list[str]:
    """
    Split SQL text into individual statements, respecting dollar-quoted
    strings ($$...$$) and function bodies.
    """
    statements: list[str] = []
    current: list[str] = []
    in_dollar_quote = False
    dollar_tag = ""

    for line in sql.split("\n"):
        stripped = line.strip()

        # Skip pure comment / blank lines when not inside a statement
        if not current and (not stripped or stripped.startswith("--")):
            continue

        current.append(line)

        # Handle dollar quoting
        if not in_dollar_quote:
            dollar_matches = re.findall(r"\$[a-zA-Z_]*\$", line)
            for dm in dollar_matches:
                if line.count(dm) % 2 == 1:
                    in_dollar_quote = True
                    dollar_tag = dm
                    break
        else:
            if dollar_tag in line and line.count(dollar_tag) % 2 == 1:
                in_dollar_quote = False
                dollar_tag = ""

        # Statement complete?
        if not in_dollar_quote and stripped.endswith(";"):
            stmt = "\n".join(current).strip()
            if stmt and not all(
                l.strip().startswith("--") or not l.strip() for l in current
            ):
                statements.append(stmt)
            current = []

    # Leftover content
    if current:
        stmt = "\n".join(current).strip()
        if stmt and not all(
            l.strip().startswith("--") or not l.strip() for l in current
        ):
            statements.append(stmt)

    return statements


def hashfile(path: str) -> str:
    """Return a short SHA-256 hex digest for a file."""
    import hashlib

    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(description="Run database migrations")
    parser.add_argument(
        "--migrations-dir",
        default=DEFAULT_MIGRATIONS_DIR,
        help="Directory containing numbered *.sql migration files",
    )
    args = parser.parse_args()

    migrations_dir = os.path.abspath(args.migrations_dir)

    print("=" * 64)
    print("  DATABASE MIGRATION RUNNER")
    print("=" * 64)

    if not DATABASE_URL:
        print("  [FAIL] DATABASE_URL not set")
        sys.exit(1)

    # --- Discover migration files ---
    print(f"\n1. Scanning {migrations_dir} for *.sql files ...")
    if not os.path.isdir(migrations_dir):
        print(f"  [FAIL] Migrations directory not found: {migrations_dir}")
        sys.exit(1)

    sql_files = sorted(
        f for f in os.listdir(migrations_dir) if f.endswith(".sql")
    )
    print(f"  [OK] Found {len(sql_files)} migration files")

    if not sql_files:
        print("  Nothing to do — exiting.")
        sys.exit(0)

    # --- Connect ---
    print("\n2. Connecting to database ...")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        cur = conn.cursor()
        print("  [OK] Connected")
    except Exception as e:
        print(f"  [FAIL] Connection failed: {e}")
        sys.exit(1)

    # --- Ensure tracking table ---
    print("\n3. Ensuring schema_migrations table ...")
    cur.execute(SCHEMA_MIGRATIONS_DDL)
    print("  [OK] schema_migrations ready")

    # --- Determine already-applied migrations ---
    cur.execute("SELECT filename FROM schema_migrations WHERE success = TRUE")
    applied = {row[0] for row in cur.fetchall()}
    pending = [f for f in sql_files if f not in applied]
    print(f"  Already applied: {len(applied)}")
    print(f"  Pending:         {len(pending)}")

    if not pending:
        print("\n  ✅ Database is up-to-date — nothing to migrate.")
        conn.close()
        sys.exit(0)

    # --- Apply pending migrations ---
    print(f"\n4. Applying {len(pending)} migration(s) ...")
    total_success = 0
    total_stmts = 0

    for filename in pending:
        filepath = os.path.join(migrations_dir, filename)
        checksum = hashfile(filepath)
        print(f"\n  ── {filename} (sha256:{checksum}) ──")

        with open(filepath, "r", encoding="utf-8-sig") as f:
            sql = f.read()

        # Strip CONCURRENTLY (cannot run inside single-connection context)
        sql = sql.replace(" CONCURRENTLY", "")

        statements = split_sql_statements(sql)
        print(f"     {len(statements)} statement(s)")

        ok = 0
        failed_stmts: list[tuple[str, str]] = []

        for i, stmt in enumerate(statements):
            first_line = ""
            for line in stmt.split("\n"):
                line = line.strip()
                if line and not line.startswith("--"):
                    first_line = line[:80]
                    break
            try:
                cur.execute(stmt)
                ok += 1
            except Exception as e:
                err = str(e).strip().split("\n")[0]
                failed_stmts.append((first_line, err))
                # Check if this is a benign "already exists" error (expected on existing DBs)
                err_lower = err.lower()
                is_benign = any(
                    phrase in err_lower
                    for phrase in [
                        "already exists",
                        "duplicate key",
                        "does not exist",    # DROP IF EXISTS on missing object
                        "could not create unique index",  # index already present
                        "multiple default values",
                    ]
                )
                if not is_benign:
                    # Only treat as critical if truly unexpected
                    is_critical = any(
                        kw in first_line.upper()
                        for kw in ["CREATE TABLE", "CREATE TYPE"]
                    )
                    if is_critical:
                        print(f"     [CRITICAL FAIL] {first_line}")
                        print(f"       Error: {err}")
                        try:
                            reconn = psycopg2.connect(DATABASE_URL)
                            reconn.autocommit = True
                            rc = reconn.cursor()
                            rc.execute(
                                "INSERT INTO schema_migrations (filename, checksum, success) "
                                "VALUES (%s, %s, FALSE) ON CONFLICT (filename) DO UPDATE "
                                "SET checksum = EXCLUDED.checksum, success = FALSE, applied_at = NOW()",
                                (filename, checksum),
                            )
                            reconn.close()
                        except Exception:
                            pass
                        conn.close()
                        sys.exit(1)

                # Reconnect cursor after ANY error (benign or non-critical)
                try:
                    cur.close()
                    cur = conn.cursor()
                except Exception:
                    conn = psycopg2.connect(DATABASE_URL)
                    conn.autocommit = True
                    cur = conn.cursor()

        # Record success
        cur.execute(
            "INSERT INTO schema_migrations (filename, checksum, success) "
            "VALUES (%s, %s, TRUE) ON CONFLICT (filename) DO UPDATE "
            "SET checksum = EXCLUDED.checksum, success = TRUE, applied_at = NOW()",
            (filename, checksum),
        )
        total_success += 1
        total_stmts += ok
        status = "✅" if not failed_stmts else "⚠️"
        print(f"     {status} {ok}/{len(statements)} statements OK")
        if failed_stmts:
            for fl, err in failed_stmts[:5]:
                print(f"        skip: {fl[:60]} → {err[:60]}")

    # --- Summary ---
    print("\n" + "=" * 64)
    print("  MIGRATION COMPLETE")
    print(f"  Files applied: {total_success}/{len(pending)}")
    print(f"  Statements:    {total_stmts} OK")
    print("=" * 64)

    conn.close()
    sys.exit(0)


if __name__ == "__main__":
    main()
