"""
Auto-sharder: splits a DataFrame across N SQLite shard files,
computes per-shard column stats (min/max/null/distinct) for predicate pushdown.
"""
import os
import math
import sqlite3
import pandas as pd
from concurrent.futures import ThreadPoolExecutor, as_completed
from queryforge.schema_registry import SchemaRegistry, SHARD_DIR
from queryforge.file_parser import DiscoveredSchema


def _build_create_sql(table_name, columns):
    col_defs = ",\n  ".join(f'"{c["name"]}" {c["sql_type"]}' for c in columns)
    return f'CREATE TABLE IF NOT EXISTS "{table_name}" (\n  {col_defs}\n)'


def _write_shard(shard_path, table_name, create_sql, df_chunk):
    conn = sqlite3.connect(shard_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(create_sql)
    df_chunk.to_sql(table_name, conn, if_exists="replace",
                    index=False, method="multi", chunksize=500)
    conn.commit()
    conn.close()

    stats = []
    for col in df_chunk.columns:
        try:
            non_null = df_chunk[col].dropna()
            if len(non_null) > 0:
                try:
                    mn = non_null.min()
                    mx = non_null.max()
                except Exception:
                    mn = mx = None
                distinct = int(non_null.nunique())
            else:
                mn = mx = None
                distinct = 0
            stats.append({
                "col_name": col,
                "min_val": mn,
                "max_val": mx,
                "null_count": int(df_chunk[col].isna().sum()),
                "distinct_count": distinct,
            })
        except Exception:
            stats.append({
                "col_name": col, "min_val": None, "max_val": None,
                "null_count": 0, "distinct_count": 0,
            })
    return stats


def shard_dataset(schema: DiscoveredSchema, shard_count: int = None) -> dict:
    df = schema.df
    total_rows = len(df)
    if shard_count is None:
        shard_count = max(2, min(8, math.ceil(total_rows / 5000)))
    shard_count = max(1, min(shard_count, 16))

    rows_per_shard = max(1, math.ceil(total_rows / shard_count))
    create_sql = _build_create_sql(schema.table_name, schema.columns)

    shard_meta = []
    all_stats = []

    futures = {}
    with ThreadPoolExecutor(max_workers=min(shard_count, 4)) as executor:
        for i in range(shard_count):
            shard_path = os.path.join(SHARD_DIR, f"{schema.table_name}_shard_{i}.db")
            if os.path.exists(shard_path):
                os.remove(shard_path)
            chunk = df.iloc[i * rows_per_shard:(i + 1) * rows_per_shard].copy()
            if len(chunk) == 0:
                continue
            future = executor.submit(_write_shard, shard_path, schema.table_name, create_sql, chunk)
            futures[future] = {
                "shard_id": i,
                "shard_path": shard_path,
                "port": 8001 + i,
                "row_count": len(chunk),
                "row_start": i * rows_per_shard,
                "row_end": min((i + 1) * rows_per_shard, total_rows) - 1,
            }
        for future in as_completed(futures):
            meta = futures[future]
            shard_meta.append(meta)
            for stat in future.result():
                all_stats.append({**stat, "shard_id": meta["shard_id"]})

    shard_meta.sort(key=lambda x: x["shard_id"])
    actual_shard_count = len(shard_meta)

    SchemaRegistry().register(
        table_name=schema.table_name,
        columns=schema.columns,
        total_rows=total_rows,
        shard_count=actual_shard_count,
        shards=shard_meta,
        shard_stats=all_stats,
        source_file=os.path.basename(schema.file_path),
    )
    return {
        "table_name": schema.table_name,
        "total_rows": total_rows,
        "shard_count": actual_shard_count,
        "columns": schema.columns,
        "shards": shard_meta,
    }
