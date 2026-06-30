"""Generates a realistic employees sample dataset for first-run demo."""
import pandas as pd
import numpy as np
import os
from queryforge.schema_registry import DATA_DIR

SAMPLE_PATH = os.path.join(DATA_DIR, "sample_employees.csv")


def ensure_sample(n_rows=20_000) -> str:
    if os.path.exists(SAMPLE_PATH):
        return SAMPLE_PATH
    np.random.seed(42)
    departments = ["Engineering", "Sales", "Marketing", "Finance",
                   "HR", "Legal", "Product", "Data", "Design", "Support"]
    regions = ["North", "South", "East", "West", "Central"]
    levels = ["Junior", "Mid", "Senior", "Staff", "Principal"]

    df = pd.DataFrame({
        "employee_id": range(1, n_rows + 1),
        "name": [f"Employee_{i}" for i in range(1, n_rows + 1)],
        "department": np.random.choice(departments, n_rows),
        "region": np.random.choice(regions, n_rows),
        "level": np.random.choice(levels, n_rows, p=[0.30, 0.35, 0.20, 0.10, 0.05]),
        "salary": np.random.randint(35_000, 320_000, n_rows),
        "age": np.random.randint(22, 65, n_rows),
        "years_exp": np.random.randint(0, 40, n_rows),
        "performance_score": np.round(np.random.uniform(1.0, 5.0, n_rows), 2),
        "is_manager": np.random.choice([0, 1], n_rows, p=[0.85, 0.15]),
        "remote": np.random.choice([0, 1], n_rows, p=[0.40, 0.60]),
    })
    df.to_csv(SAMPLE_PATH, index=False)
    return SAMPLE_PATH
