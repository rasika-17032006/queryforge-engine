"""
Simulated worker pool — in-process async workers that mimic the
network-based worker behavior from the original guide.

In production, each worker would be a separate FastAPI process on a different
machine. Here they share the process, communicating via direct async function
calls — the same scatter-gather logic, same fault model (we can inject failures),
just no network hop. Defensible interview answer: "I extracted the network layer
to validate the planner+merger logic; the executor interface is unchanged."
"""
import asyncio
import time
import os
import random
import aiosqlite
from queryforge.schema_registry import SchemaRegistry

# Failure injection state (controllable from UI)
_failed_shards = set()  # (table_name, shard_id) tuples


def fail_shard(table_name: str, shard_id: int):
    _failed_shards.add((table_name, shard_id))
    SchemaRegistry().update_shard_status(table_name, shard_id, "dead")


def recover_shard(table_name: str, shard_id: int):
    _failed_shards.discard((table_name, shard_id))
    SchemaRegistry().update_shard_status(table_name, shard_id, "online")


def is_failed(table_name, shard_id):
    return (table_name, shard_id) in _failed_shards


async def execute_on_shard(table_name: str, shard_id: int,
                           shard_path: str, sql: str, query_id: str) -> dict:
    """Execute SQL on a single shard SQLite file."""
    start = time.perf_counter()

    if is_failed(table_name, shard_id):
        await asyncio.sleep(0.01)
        return {
            "shard_id": shard_id, "query_id": query_id,
            "status": "dead", "rows": [], "columns": [],
            "row_count": 0,
            "latency_ms": round((time.perf_counter() - start) * 1000, 2),
            "error": f"Shard {shard_id} is marked dead (injected failure).",
        }

    if not os.path.exists(shard_path):
        return {
            "shard_id": shard_id, "query_id": query_id,
            "status": "missing", "rows": [], "columns": [],
            "row_count": 0, "latency_ms": 0,
            "error": f"Shard DB file not found: {shard_path}",
        }

    try:
        # Add a tiny random jitter to simulate per-node variance (realistic feel)
        jitter = random.uniform(0.005, 0.025)
        await asyncio.sleep(jitter)
        async with aiosqlite.connect(shard_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(sql) as cursor:
                rows = await cursor.fetchall()
                columns = [d[0] for d in cursor.description] if cursor.description else []
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        return {
            "shard_id": shard_id, "query_id": query_id,
            "status": "ok",
            "columns": columns,
            "rows": [dict(r) for r in rows],
            "row_count": len(rows),
            "latency_ms": latency_ms,
        }
    except Exception as e:
        return {
            "shard_id": shard_id, "query_id": query_id,
            "status": "error", "rows": [], "columns": [],
            "row_count": 0,
            "latency_ms": round((time.perf_counter() - start) * 1000, 2),
            "error": str(e),
        }


async def health_check_shard(table_name: str, shard_id: int, shard_path: str) -> dict:
    if is_failed(table_name, shard_id):
        return {"shard_id": shard_id, "status": "dead", "size_mb": 0}
    exists = os.path.exists(shard_path)
    size_mb = round(os.path.getsize(shard_path) / 1024 / 1024, 2) if exists else 0
    return {
        "shard_id": shard_id,
        "status": "online" if exists else "missing",
        "size_mb": size_mb,
    }
