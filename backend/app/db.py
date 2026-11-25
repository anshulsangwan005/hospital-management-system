"""Database access: a small connection pool + helpers. All business rules live in PostgreSQL."""
import os
from contextlib import contextmanager

from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://hms:hms_password@localhost:5432/hospital")
ENC_KEY = os.getenv("ENC_KEY", "change-this-encryption-key")

_pool = None


def _get_pool() -> ThreadedConnectionPool:
    global _pool
    if _pool is None:
        _pool = ThreadedConnectionPool(1, 10, DATABASE_URL)
    return _pool


@contextmanager
def transaction():
    """One ACID transaction: commit on success, rollback on any exception."""
    pool = _get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


def query(sql, params=None, one=False):
    """Run a single statement in its own transaction. Returns rows (or None if no result set)."""
    with transaction() as cur:
        cur.execute(sql, params)
        if cur.description is None:
            return None
        return cur.fetchone() if one else cur.fetchall()
