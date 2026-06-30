"""
Result merger: combines partial shard results into the final result set.
Handles aggregate reductions (SUM, MAX, MIN, AVG reconstruction), GROUP BY merging,
ORDER BY and LIMIT at coordinator level.
"""
from collections import defaultdict


def _apply_reductions(rows, instructions):
    out = {}
    for inst in instructions:
        t = inst["type"]
        col = inst.get("col", "")
        if t == "sum":
            out[col] = round(sum((r.get(col) or 0) for r in rows), 4)
        elif t == "max":
            vals = [r.get(col) for r in rows if r.get(col) is not None]
            out[col] = max(vals) if vals else None
        elif t == "min":
            vals = [r.get(col) for r in rows if r.get(col) is not None]
            out[col] = min(vals) if vals else None
        elif t == "avg_reconstruct":
            tot_sum = sum((r.get(inst["sum_col"]) or 0) for r in rows)
            tot_cnt = sum((r.get(inst["cnt_col"]) or 0) for r in rows)
            out[inst["output_alias"]] = round(tot_sum / tot_cnt, 4) if tot_cnt else None
    return out


def merge_results(shard_results, merge_instructions, group_by,
                  order_by=None, limit=None):
    all_rows = []
    for sr in shard_results:
        if sr.get("status") == "ok":
            all_rows.extend(sr.get("rows", []))

    def sort_rows(rows):
        if order_by:
            for ob in reversed(order_by):
                col = ob.replace(" DESC", "").replace(" ASC", "").strip().strip('"').strip("`")
                reverse = "DESC" in ob.upper()
                try:
                    rows.sort(
                        key=lambda r: (r.get(col) is None, r.get(col) if r.get(col) is not None else 0),
                        reverse=reverse,
                    )
                except TypeError:
                    pass
        return rows[:limit] if limit else rows

    if not merge_instructions:
        return sort_rows(all_rows)

    if not group_by:
        result = _apply_reductions(all_rows, merge_instructions)
        return [result] if result else []

    groups = defaultdict(list)
    for row in all_rows:
        key = tuple(row.get(g) for g in group_by)
        groups[key].append(row)

    result = []
    for key, rows in groups.items():
        base = dict(zip(group_by, key))
        base.update(_apply_reductions(rows, merge_instructions))
        result.append(base)

    return sort_rows(result)
