"""File parser: discovers schema and dtypes from CSV/Excel."""
import os
import pandas as pd
from dataclasses import dataclass
from typing import List, Any

DTYPE_MAP = {
    "int64": "INTEGER", "int32": "INTEGER", "Int64": "INTEGER",
    "float64": "REAL", "float32": "REAL",
    "object": "TEXT", "string": "TEXT",
    "bool": "INTEGER",
    "datetime64[ns]": "TEXT",
}


@dataclass
class DiscoveredSchema:
    table_name: str
    columns: list
    row_count: int
    file_path: str
    df: Any


def _normalize_name(s: str) -> str:
    return (
        str(s).strip().lower()
        .replace(" ", "_").replace("-", "_")
        .replace(".", "_").replace("/", "_")
        .replace("(", "").replace(")", "")
        .replace("#", "num").replace("$", "usd")
    ) or "col"


def parse_file(file_path: str, table_name: str = None) -> DiscoveredSchema:
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".csv":
        df = pd.read_csv(file_path, low_memory=False)
    elif ext in (".xlsx", ".xls"):
        df = pd.read_excel(file_path)
    elif ext == ".json":
        df = pd.read_json(file_path)
    else:
        raise ValueError(f"Unsupported format: {ext}. Use CSV, XLSX, or JSON.")

    # Normalize column names
    new_cols = []
    seen = {}
    for c in df.columns:
        n = _normalize_name(c)
        if n in seen:
            seen[n] += 1
            n = f"{n}_{seen[n]}"
        else:
            seen[n] = 0
        new_cols.append(n)
    df.columns = new_cols

    if not table_name:
        base = os.path.splitext(os.path.basename(file_path))[0]
        table_name = _normalize_name(base)

    columns = []
    for col in df.columns:
        dtype_str = str(df[col].dtype)
        sql_type = DTYPE_MAP.get(dtype_str, "TEXT")
        sample = df[col].dropna().head(3).tolist()
        # Make samples JSON-safe
        safe_sample = []
        for s in sample:
            try:
                if pd.isna(s):
                    continue
                safe_sample.append(str(s)[:50])
            except Exception:
                safe_sample.append(str(s)[:50])
        columns.append({
            "name": col,
            "pandas_dtype": dtype_str,
            "sql_type": sql_type,
            "sample_values": safe_sample,
            "null_count": int(df[col].isna().sum())
        })

    return DiscoveredSchema(
        table_name=table_name,
        columns=columns,
        row_count=len(df),
        file_path=file_path,
        df=df,
    )
