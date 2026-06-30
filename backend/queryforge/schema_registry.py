"""
WAL-backed SQLite registry for QueryForge.
Stores table metadata, shard mapping, column stats, latency history.
ACID-compliant atomic writes — no JSON corruption possible.
"""
import sqlite3
import os
import threading
import datetime
from collections import defaultdict
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "qf_data"
SHARD_DIR = DATA_DIR / "shards"
DATA_DIR.mkdir(exist_ok=True)
SHARD_DIR.mkdir(exist_ok=True)

REGISTRY_DB = str(DATA_DIR / "registry.db")
_lock = threading.Lock()


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(REGISTRY_DB, check_same_thread=False, timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.row_factory = sqlite3.Row
    return conn


def _init_db():
    conn = _get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS tables (
            table_name  TEXT PRIMARY KEY,
            total_rows  INTEGER,
            shard_count INTEGER,
            source_file TEXT,
            created_at  TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS columns (
            table_name  TEXT,
            col_name    TEXT,
            sql_type    TEXT,
            pandas_dtype TEXT,
            null_count  INTEGER DEFAULT 0,
            sample_values TEXT,
            PRIMARY KEY (table_name, col_name)
        );
        CREATE TABLE IF NOT EXISTS shards (
            table_name  TEXT,
            shard_id    INTEGER,
            shard_path  TEXT,
            port        INTEGER,
            row_count   INTEGER,
            row_start   INTEGER,
            row_end     INTEGER,
            status      TEXT DEFAULT 'online',
            last_seen   TEXT,
            PRIMARY KEY (table_name, shard_id)
        );
        CREATE TABLE IF NOT EXISTS column_stats (
            table_name  TEXT,
            shard_id    INTEGER,
            col_name    TEXT,
            min_val     TEXT,
            max_val     TEXT,
            null_count  INTEGER DEFAULT 0,
            distinct_count INTEGER DEFAULT 0,
            PRIMARY KEY (table_name, shard_id, col_name)
        );
        CREATE TABLE IF NOT EXISTS latency_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name  TEXT,
            shard_id    INTEGER,
            query_id    TEXT,
            latency_ms  REAL,
            logged_at   TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_lat_shard ON latency_log(table_name, shard_id);

        CREATE TABLE IF NOT EXISTS query_history (
            query_id    TEXT PRIMARY KEY,
            sql         TEXT,
            table_name  TEXT,
            total_ms    REAL,
            row_count   INTEGER,
            strategy    TEXT,
            pruned_shards TEXT,
            partial     INTEGER,
            ts          TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS saved_queries (
            id          TEXT PRIMARY KEY,
            name        TEXT,
            sql         TEXT,
            created_at  TEXT DEFAULT (datetime('now'))
        );
    """)
    conn.commit()
    conn.close()


_init_db()


class SchemaRegistry:
    def register(self, table_name, columns, total_rows, shard_count, shards,
                 shard_stats=None, source_file=None):
        with _lock:
            conn = _get_conn()
            try:
                conn.execute("BEGIN")
                conn.execute("DELETE FROM column_stats WHERE table_name=?", (table_name,))
                conn.execute("DELETE FROM columns WHERE table_name=?", (table_name,))
                conn.execute("DELETE FROM shards WHERE table_name=?", (table_name,))
                conn.execute(
                    "INSERT OR REPLACE INTO tables (table_name, total_rows, shard_count, source_file) VALUES (?, ?, ?, ?)",
                    (table_name, total_rows, shard_count, source_file or "")
                )
                for col in columns:
                    sample = col.get("sample_values", [])
                    sample_str = ", ".join(str(s)[:30] for s in sample[:3])
                    conn.execute(
                        "INSERT INTO columns (table_name, col_name, sql_type, pandas_dtype, null_count, sample_values) VALUES (?, ?, ?, ?, ?, ?)",
                        (table_name, col["name"], col["sql_type"],
                         col.get("pandas_dtype", "TEXT"),
                         col.get("null_count", 0), sample_str)
                    )
                for s in shards:
                    conn.execute(
                        "INSERT INTO shards (table_name, shard_id, shard_path, port, row_count, row_start, row_end, status, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, 'online', ?)",
                        (table_name, s["shard_id"], s["shard_path"], s["port"],
                         s["row_count"], s.get("row_start", 0),
                         s.get("row_end", 0), datetime.datetime.now().isoformat())
                    )
                if shard_stats:
                    for stat in shard_stats:
                        conn.execute(
                            "INSERT INTO column_stats (table_name, shard_id, col_name, min_val, max_val, null_count, distinct_count) VALUES (?, ?, ?, ?, ?, ?, ?)",
                            (table_name, stat["shard_id"], stat["col_name"],
                             str(stat.get("min_val") or ""),
                             str(stat.get("max_val") or ""),
                             stat.get("null_count", 0),
                             stat.get("distinct_count", 0))
                        )
                conn.execute("COMMIT")
            except Exception:
                conn.execute("ROLLBACK")
                raise
            finally:
                conn.close()

    def get_table(self, table_name):
        conn = _get_conn()
        try:
            row = conn.execute("SELECT * FROM tables WHERE table_name=?", (table_name,)).fetchone()
            if not row:
                all_t = [r[0] for r in conn.execute("SELECT table_name FROM tables").fetchall()]
                raise KeyError(f"Table '{table_name}' not found. Available: {all_t}")
            columns = [dict(r) for r in conn.execute(
                "SELECT * FROM columns WHERE table_name=? ORDER BY col_name", (table_name,)
            ).fetchall()]
            shards = [dict(r) for r in conn.execute(
                "SELECT * FROM shards WHERE table_name=? ORDER BY shard_id", (table_name,)
            ).fetchall()]
            return {
                "table_name": table_name,
                "total_rows": row["total_rows"],
                "shard_count": row["shard_count"],
                "source_file": row["source_file"],
                "created_at": row["created_at"],
                "columns": columns,
                "shards": shards,
            }
        finally:
            conn.close()

    def list_tables(self):
        conn = _get_conn()
        try:
            tables = conn.execute("SELECT * FROM tables ORDER BY created_at DESC").fetchall()
            result = []
            for t in tables:
                tn = t["table_name"]
                cols = [dict(r) for r in conn.execute(
                    "SELECT * FROM columns WHERE table_name=? ORDER BY col_name", (tn,)
                ).fetchall()]
                shards = [dict(r) for r in conn.execute(
                    "SELECT * FROM shards WHERE table_name=? ORDER BY shard_id", (tn,)
                ).fetchall()]
                result.append({
                    "table_name": tn,
                    "total_rows": t["total_rows"],
                    "shard_count": t["shard_count"],
                    "source_file": t["source_file"],
                    "created_at": t["created_at"],
                    "columns": cols,
                    "shards": shards,
                })
            return result
        finally:
            conn.close()

    def drop_table(self, table_name):
        with _lock:
            conn = _get_conn()
            try:
                conn.execute("BEGIN")
                # Delete shard files
                for s in conn.execute("SELECT shard_path FROM shards WHERE table_name=?", (table_name,)).fetchall():
                    try:
                        if s["shard_path"] and os.path.exists(s["shard_path"]):
                            os.remove(s["shard_path"])
                    except Exception:
                        pass
                conn.execute("DELETE FROM column_stats WHERE table_name=?", (table_name,))
                conn.execute("DELETE FROM columns WHERE table_name=?", (table_name,))
                conn.execute("DELETE FROM shards WHERE table_name=?", (table_name,))
                conn.execute("DELETE FROM latency_log WHERE table_name=?", (table_name,))
                conn.execute("DELETE FROM tables WHERE table_name=?", (table_name,))
                conn.execute("COMMIT")
            except Exception:
                conn.execute("ROLLBACK")
                raise
            finally:
                conn.close()

    def update_shard_status(self, table_name, shard_id, status, last_seen=None):
        with _lock:
            conn = _get_conn()
            try:
                conn.execute(
                    "UPDATE shards SET status=?, last_seen=? WHERE table_name=? AND shard_id=?",
                    (status, last_seen or datetime.datetime.now().isoformat(), table_name, shard_id)
                )
                conn.commit()
            finally:
                conn.close()

    def get_column_stats(self, table_name, col_name):
        conn = _get_conn()
        try:
            return [dict(r) for r in conn.execute(
                "SELECT shard_id, min_val, max_val, null_count, distinct_count FROM column_stats WHERE table_name=? AND col_name=?",
                (table_name, col_name)
            ).fetchall()]
        finally:
            conn.close()

    def log_latency(self, table_name, shard_id, query_id, latency_ms):
        with _lock:
            conn = _get_conn()
            try:
                conn.execute(
                    "INSERT INTO latency_log (table_name, shard_id, query_id, latency_ms) VALUES (?, ?, ?, ?)",
                    (table_name, shard_id, query_id, latency_ms)
                )
                # Rolling window: keep last 500 per shard
                conn.execute("""
                    DELETE FROM latency_log
                    WHERE id IN (
                        SELECT id FROM latency_log
                        WHERE table_name=? AND shard_id=?
                        ORDER BY id DESC LIMIT -1 OFFSET 500
                    )
                """, (table_name, shard_id))
                conn.commit()
            finally:
                conn.close()

    def get_shard_latency_profile(self, table_name):
        conn = _get_conn()
        try:
            rows = conn.execute(
                "SELECT shard_id, latency_ms FROM latency_log WHERE table_name=? ORDER BY shard_id",
                (table_name,)
            ).fetchall()
            buckets = defaultdict(list)
            for r in rows:
                buckets[r["shard_id"]].append(r["latency_ms"])
            profile = {}
            for sid, latencies in buckets.items():
                n = len(latencies)
                sorted_l = sorted(latencies)
                profile[sid] = {
                    "p50": sorted_l[int(n * 0.5)] if n else 0,
                    "p95": sorted_l[min(int(n * 0.95), n - 1)] if n else 0,
                    "p99": sorted_l[min(int(n * 0.99), n - 1)] if n else 0,
                    "mean": round(sum(sorted_l) / n, 2) if n else 0,
                    "min": sorted_l[0] if n else 0,
                    "max": sorted_l[-1] if n else 0,
                    "sample_count": n,
                }
            return profile
        finally:
            conn.close()

    def log_query(self, query_id, sql, table_name, total_ms, row_count,
                  strategy, pruned_shards, partial):
        with _lock:
            conn = _get_conn()
            try:
                conn.execute(
                    "INSERT OR REPLACE INTO query_history (query_id, sql, table_name, total_ms, row_count, strategy, pruned_shards, partial) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (query_id, sql, table_name, total_ms, row_count, strategy,
                     ",".join(str(s) for s in pruned_shards), 1 if partial else 0)
                )
                conn.commit()
            finally:
                conn.close()

    def list_history(self, limit=100):
        conn = _get_conn()
        try:
            rows = conn.execute(
                "SELECT * FROM query_history ORDER BY ts DESC LIMIT ?", (limit,)
            ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def clear_history(self):
        """Permanently purges the history logs from the active SQLite connection."""
        if hasattr(self, 'conn') and self.conn:
            self.conn.execute("DELETE FROM query_history;")

    def save_query(self, qid, name, sql):
        with _lock:
            conn = _get_conn()
            try:
                conn.execute(
                    "INSERT OR REPLACE INTO saved_queries (id, name, sql) VALUES (?, ?, ?)",
                    (qid, name, sql)
                )
                conn.commit()
            finally:
                conn.close()

    def list_saved(self):
        conn = _get_conn()
        try:
            return [dict(r) for r in conn.execute(
                "SELECT * FROM saved_queries ORDER BY created_at DESC"
            ).fetchall()]
        finally:
            conn.close()

    def delete_saved(self, qid):
        with _lock:
            conn = _get_conn()
            try:
                conn.execute("DELETE FROM saved_queries WHERE id=?", (qid,))
                conn.commit()
            finally:
                conn.close()
