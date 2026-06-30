"""
Async scatter-gather: fan out shard SQL to all target shards in parallel,
collect results, log per-shard latency for adaptive router.
"""
import asyncio
import uuid
import time
from queryforge.query_planner import ExecutionPlan
from queryforge.simulated_workers import execute_on_shard
from queryforge.schema_registry import SchemaRegistry

TIMEOUT_S = 5.0


async def scatter_gather(exec_plan: ExecutionPlan, query_id: str = None) -> dict:
    query_id = query_id or str(uuid.uuid4())[:8]
    start = time.perf_counter()
    registry = SchemaRegistry()

    # Look up shard paths
    table_meta = registry.get_table(exec_plan.table_name)
    path_map = {s["shard_id"]: s["shard_path"] for s in table_meta["shards"]}

    async def run_one(sid):
        try:
            return await asyncio.wait_for(
                execute_on_shard(
                    exec_plan.table_name, sid, path_map[sid],
                    exec_plan.shard_sql, query_id
                ),
                timeout=TIMEOUT_S
            )
        except asyncio.TimeoutError:
            return {
                "shard_id": sid, "query_id": query_id,
                "status": "timeout", "rows": [], "columns": [],
                "row_count": 0, "latency_ms": TIMEOUT_S * 1000,
                "error": f"Shard {sid} timed out after {TIMEOUT_S}s",
            }

    tasks = [run_one(sid) for sid in exec_plan.target_shards if sid in path_map]
    results = await asyncio.gather(*tasks)

    total_ms = round((time.perf_counter() - start) * 1000, 2)

    for r in results:
        if r.get("status") == "ok":
            registry.log_latency(
                exec_plan.table_name, r["shard_id"],
                query_id, r.get("latency_ms", 0)
            )

    online = [r for r in results if r.get("status") == "ok"]
    failed = [r for r in results if r.get("status") != "ok"]

    return {
        "query_id": query_id,
        "shard_results": results,
        "online_shards": len(online),
        "failed_shards": len(failed),
        "failed_shard_ids": [r["shard_id"] for r in failed],
        "total_latency_ms": total_ms,
        "partial_result": len(failed) > 0,
    }
