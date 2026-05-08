"""
Run Oracle DDL + seed against the MDS schema.

Usage:
    python sql/run_oracle.py           # runs DDL + seed
    python sql/run_oracle.py --drop    # drops all objects first
    python sql/run_oracle.py --seed    # seed only

Env vars (override via .env):
    MDS_DB_USER, MDS_DB_PASSWORD, MDS_DB_DSN
"""
import os, sys, re, argparse
from pathlib import Path
import oracledb

HERE = Path(__file__).parent
ORACLE_DIR = HERE / "oracle"

USER = os.environ.get("MDS_DB_USER", "MDS")
PASSWORD = os.environ.get("MDS_DB_PASSWORD", "change-me")
DSN = os.environ.get("MDS_DB_DSN", "localhost:1521/ARCOREDB")


def split_statements(sql_text: str):
    # Remove line comments
    cleaned = re.sub(r"^\s*--[^\n]*$", "", sql_text, flags=re.MULTILINE)
    # Split on ; at end of line
    parts = [p.strip() for p in cleaned.split(";")]
    return [p for p in parts if p and not p.isspace()]


def run_file(cur, path: Path):
    print(f"\n▶ {path.name}")
    sql = path.read_text(encoding="utf-8")
    stmts = split_statements(sql)
    ok, skip, fail = 0, 0, 0
    for stmt in stmts:
        short = stmt[:70].replace("\n", " ")
        try:
            cur.execute(stmt)
            ok += 1
        except oracledb.DatabaseError as e:
            err = str(e)
            if "ORA-00955" in err or "ORA-01920" in err or "ORA-02260" in err or "ORA-00001" in err:
                skip += 1  # object/user/PK already exists
            else:
                fail += 1
                print(f"  ✗ {short}\n    {err.splitlines()[0]}")
    print(f"  ok={ok}  skipped={skip}  fail={fail}")
    return fail == 0


def drop_all(cur):
    print("▶ Dropping all MDS_* tables")
    cur.execute("""SELECT table_name FROM user_tables WHERE table_name LIKE 'MDS%'""")
    tables = [r[0] for r in cur.fetchall()]
    for t in tables:
        try:
            cur.execute(f'DROP TABLE "{t}" CASCADE CONSTRAINTS')
            print(f"  dropped {t}")
        except oracledb.DatabaseError as e:
            print(f"  ✗ {t}: {str(e).splitlines()[0]}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--drop", action="store_true", help="drop all MDS tables first")
    ap.add_argument("--seed", action="store_true", help="seed only (skip DDL)")
    args = ap.parse_args()

    print(f"Connecting {USER}@{DSN}")
    conn = oracledb.connect(user=USER, password=PASSWORD, dsn=DSN)
    cur = conn.cursor()

    if args.drop:
        drop_all(cur)
        conn.commit()

    if not args.seed:
        run_file(cur, ORACLE_DIR / "01_schema.sql")
        conn.commit()

    run_file(cur, ORACLE_DIR / "02_seed.sql")
    conn.commit()

    cur.execute("SELECT table_name, (SELECT COUNT(*) FROM user_tab_columns c WHERE c.table_name = t.table_name) FROM user_tables t WHERE table_name LIKE 'MDS%' ORDER BY table_name")
    print("\nTables in MDS schema:")
    for name, ncols in cur.fetchall():
        cur.execute(f'SELECT COUNT(*) FROM "{name}"')
        rows = cur.fetchone()[0]
        print(f"  {name:35s}  {ncols} cols  {rows} rows")

    cur.close()
    conn.close()
    print("\n✓ done")


if __name__ == "__main__":
    main()
