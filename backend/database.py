"""
Database connectivity for MiniMemo.
Supports PostgreSQL, MySQL, and SQLite via SQLAlchemy.
Credentials are never persisted -- used per-request then discarded.
"""

import re
from typing import Any

import pandas as pd
from sqlalchemy import create_engine, inspect, text

MAX_ROWS = 200_000
QUERY_TIMEOUT = 30  # seconds


def build_connection_url(
    db_type: str,
    host: str,
    port: int | None,
    database: str,
    username: str,
    password: str,
) -> str:
    if db_type == "sqlite":
        return f"sqlite:///{database}"
    if db_type == "postgresql":
        p = port or 5432
        return f"postgresql+psycopg2://{username}:{password}@{host}:{p}/{database}"
    if db_type == "mysql":
        p = port or 3306
        return f"mysql+pymysql://{username}:{password}@{host}:{p}/{database}"
    raise ValueError(f"Unsupported db_type: {db_type}")


def _make_engine(url: str, timeout: int = 5):
    connect_args: dict[str, Any] = {}
    if url.startswith("postgresql"):
        connect_args = {"connect_timeout": timeout}
    elif url.startswith("mysql"):
        connect_args = {"connect_timeout": timeout}
    return create_engine(url, connect_args=connect_args, pool_pre_ping=True)


def test_connection(url: str) -> dict:
    """
    Validates a connection and returns the list of table names.
    Returns {ok: bool, tables: list[str], error: str | None}.
    """
    engine = None
    try:
        engine = _make_engine(url, timeout=5)
        with engine.connect():
            tables = inspect(engine).get_table_names()
        return {"ok": True, "tables": sorted(tables), "error": None}
    except Exception as exc:
        return {"ok": False, "tables": [], "error": str(exc)}
    finally:
        if engine is not None:
            engine.dispose()


def fetch_table_preview(url: str, table: str, limit: int = 50) -> pd.DataFrame:
    """
    Returns the first `limit` rows of a table as a DataFrame.
    The table name is validated against the actual schema to prevent injection.
    Uses a LIMIT query to avoid loading all rows into memory.
    """
    engine = _make_engine(url)
    try:
        available = inspect(engine).get_table_names()
        if table not in available:
            raise ValueError(f"Table '{table}' not found in database.")
        with engine.connect() as conn:
            # table is validated above; limit is an int — no injection risk
            df = pd.read_sql(text(f"SELECT * FROM {table} LIMIT {limit}"), conn)
        return df
    finally:
        engine.dispose()


def fetch_preview_data(url: str, table: str, limit: int = 50) -> tuple[pd.DataFrame, int]:
    """
    Returns (preview_df, row_count) in a single connection.
    Avoids the double engine-creation that happens when calling
    fetch_table_preview + get_row_count_estimate separately.
    """
    engine = _make_engine(url)
    try:
        available = inspect(engine).get_table_names()
        if table not in available:
            raise ValueError(f"Table '{table}' not found in database.")
        with engine.connect() as conn:
            df = pd.read_sql(text(f"SELECT * FROM {table} LIMIT {limit}"), conn)
            row_count = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar() or 0
        return df, row_count
    finally:
        engine.dispose()


def _is_read_only_query(query: str) -> bool:
    """
    Rejects anything that is not a SELECT or CTE (WITH ... SELECT).
    Simple heuristic -- not a full SQL parser, but adequate for MVP.
    """
    stripped = re.sub(r"--[^\n]*", "", query)       # remove line comments
    stripped = re.sub(r"/\*.*?\*/", "", stripped, flags=re.DOTALL)  # block comments
    stripped = stripped.strip().upper()
    return stripped.startswith("SELECT") or stripped.startswith("WITH")


def _wrap_with_limit(query: str, max_rows: int, dialect_name: str) -> str:
    """Wrap a SELECT/CTE in a subquery to cap rows server-side."""
    stripped = query.strip().rstrip(";")
    if dialect_name in ("postgresql", "mysql"):
        return f"SELECT * FROM ({stripped}) AS _q LIMIT {max_rows}"
    # SQLite does not require a subquery alias
    return f"SELECT * FROM ({stripped}) LIMIT {max_rows}"


def execute_query(url: str, query: str, max_rows: int = MAX_ROWS) -> pd.DataFrame:
    """
    Executes a read-only SQL query and returns a DataFrame.
    Enforces max row limit (server-side via LIMIT subquery) and query timeout.
    Raises ValueError for non-SELECT queries.
    """
    if not _is_read_only_query(query):
        raise ValueError("Only SELECT queries are allowed.")

    engine = _make_engine(url)
    try:
        dialect = engine.dialect.name
        limited_query = _wrap_with_limit(query, max_rows, dialect)

        with engine.connect() as conn:
            # Apply statement-level query timeout where supported
            if dialect == "postgresql":
                conn.execute(text("SET TRANSACTION READ ONLY"))
                conn.execute(text(f"SET LOCAL statement_timeout = {QUERY_TIMEOUT * 1000}"))
            elif dialect == "mysql":
                conn.execute(text("SET SESSION TRANSACTION READ ONLY"))
                conn.execute(text(f"SET SESSION MAX_EXECUTION_TIME = {QUERY_TIMEOUT * 1000}"))

            df = pd.read_sql(text(limited_query), conn)

        return df
    finally:
        engine.dispose()


def get_row_count_estimate(url: str, table: str) -> int:
    """
    Returns an approximate row count for a table.
    Uses exact COUNT(*) -- fast enough for typical business tables.
    """
    engine = _make_engine(url)
    try:
        available = inspect(engine).get_table_names()
        if table not in available:
            raise ValueError(f"Table '{table}' not found in database.")
        with engine.connect() as conn:
            result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
            return result.scalar() or 0
    finally:
        engine.dispose()
