"""
Cost-based query planner with predicate pushdown.
Uses min/max column stats per shard to skip provably empty shards at query time.
Mirrors Parquet row group statistics / Snowflake zone maps.
"""
from dataclasses import dataclass
from queryforge.sql_parser import LogicalPlan
from queryforge.schema_registry import SchemaRegistry


@dataclass
class ExecutionPlan:
    strategy: str
    target_shards: list
    shard_ports: dict

    
    shard_sql: str
    merge_instructions: list
    estimated_rows: int
    plan_explanation: list
    table_name: str
    pruned_shards: list
    group_by: list
    order_by: list
    limit: int


def _can_prune_shard(shard_stats_per_col, predicates):
    """
    Returns True if shard provably cannot satisfy WHERE.
    shard_stats_per_col: dict {col_name: {min_val, max_val}}
    """
    for pred in predicates:
        col, op, val_str = pred["col"], pred["op"], pred["val"]
        if col not in shard_stats_per_col:
            continue
        s = shard_stats_per_col[col]
        try:
            val = float(val_str)
            shard_min = float(s["min_val"]) if s["min_val"] not in (None, "", "None") else None
            shard_max = float(s["max_val"]) if s["max_val"] not in (None, "", "None") else None
            if shard_min is None or shard_max is None:
                continue
        except (ValueError, TypeError):
            continue
        if op == "GT" and shard_max <= val:
            return True
        if op == "GTE" and shard_max < val:
            return True
        if op == "LT" and shard_min >= val:
            return True
        if op == "LTE" and shard_min > val:
            return True
        if op == "EQ" and (val < shard_min or val > shard_max):
            return True
    return False


def build_execution_plan(plan: LogicalPlan) -> ExecutionPlan:
    registry = SchemaRegistry()
    table_meta = registry.get_table(plan.table)
    shards = table_meta["shards"]
    explanation = []
    pruned_shards = []

    # IMPORTANT: do NOT exclude dead shards here. We keep them in target_shards
    # so scatter_gather still attempts them and surfaces them as failed in telemetry —
    # otherwise partial_result/failed_shards would be silently 0.
    live_shards = shards
    target_shards = [s["shard_id"] for s in live_shards]
    shard_ports = {s["shard_id"]: s["port"] for s in live_shards}

    # Predicate pushdown
    if plan.filter_predicates and live_shards:
        # Build map: shard_id -> {col: stats}
        all_cols_in_pred = list({p["col"] for p in plan.filter_predicates})
        per_shard_col_stats = {sid: {} for sid in target_shards}
        for col in all_cols_in_pred:
            for st in registry.get_column_stats(plan.table, col):
                if st["shard_id"] in per_shard_col_stats:
                    per_shard_col_stats[st["shard_id"]][col] = st

        surviving = []
        for sid in target_shards:
            stats_map = per_shard_col_stats.get(sid, {})
            if stats_map and _can_prune_shard(stats_map, plan.filter_predicates):
                pruned_shards.append(sid)
                explanation.append(
                    f"Predicate pushdown: shard-{sid} pruned (column stats prove WHERE cannot match)."
                )
            else:
                surviving.append(sid)
        target_shards = surviving
        if pruned_shards:
            explanation.append(
                f"Pruned {len(pruned_shards)} shard(s) via min/max statistics; scanning {len(target_shards)} shard(s)."
            )

    # Strategy
    strategy = "broadcast"
    if plan.limit and not plan.aggregates and not plan.group_by and target_shards:
        target_shards = [target_shards[0]]
        strategy = "targeted"
        explanation.append(
            f"Targeted: LIMIT {plan.limit} without aggregation → single-shard fan-out (O(1))."
        )

    if strategy == "broadcast":
        explanation.append(
            f"Broadcast across {len(target_shards)} shard(s)"
            + (f", {len(pruned_shards)} pruned." if pruned_shards else ".")
        )

    # Aggregate rewriting: AVG → SUM+COUNT for correctness
    merge_instructions = []
    rewritten_selects = []
    for col in plan.group_by:
        rewritten_selects.append(f'"{col}"')
    for col in plan.select_cols:
        if col == "*":
            rewritten_selects.append("*")
        elif col not in plan.group_by:
            rewritten_selects.append(f'"{col}"')

    for agg in plan.aggregates:
        col, func, alias = agg["col"], agg["func"], agg["alias"]
        if func == "AVG":
            rewritten_selects += [
                f'SUM("{col}") AS _qf_sum_{col}',
                f'COUNT("{col}") AS _qf_cnt_{col}',
            ]
            merge_instructions.append({
                "type": "avg_reconstruct",
                "output_alias": alias,
                "sum_col": f"_qf_sum_{col}",
                "cnt_col": f"_qf_cnt_{col}",
            })
            explanation.append(
                f"AVG({col}) decomposed → SUM+COUNT per shard. Coordinator computes Σsum/Σcount (mathematically correct)."
            )
        elif func in ("COUNT", "SUM"):
            tgt = "*" if col == "*" else f'"{col}"'
            rewritten_selects.append(f'{func}({tgt}) AS "{alias}"')
            merge_instructions.append({"type": "sum", "col": alias})
        elif func == "MAX":
            rewritten_selects.append(f'MAX("{col}") AS "{alias}"')
            merge_instructions.append({"type": "max", "col": alias})
        elif func == "MIN":
            rewritten_selects.append(f'MIN("{col}") AS "{alias}"')
            merge_instructions.append({"type": "min", "col": alias})

    select_clause = ", ".join(dict.fromkeys(rewritten_selects)) or "*"
    shard_sql = f'SELECT {select_clause} FROM "{plan.table}"'
    if plan.filters:
        shard_sql += f" WHERE {' AND '.join(plan.filters)}"
    if plan.group_by:
        shard_sql += " GROUP BY " + ", ".join(f'"{g}"' for g in plan.group_by)
    if plan.order_by and not plan.aggregates:
        shard_sql += f" ORDER BY {', '.join(plan.order_by)}"
    if plan.limit and strategy == "targeted":
        shard_sql += f" LIMIT {plan.limit}"

    estimated_rows = sum(
        s["row_count"] for s in live_shards if s["shard_id"] in target_shards
    )

    return ExecutionPlan(
        strategy=strategy,
        target_shards=target_shards,
        shard_ports={k: v for k, v in shard_ports.items() if k in target_shards},
        shard_sql=shard_sql,
        merge_instructions=merge_instructions,
        estimated_rows=estimated_rows,
        plan_explanation=explanation,
        table_name=plan.table,
        pruned_shards=pruned_shards,
        group_by=plan.group_by,
        order_by=plan.order_by,
        limit=plan.limit,
    )
