"""
SQL parser using sqlglot.
Extracts logical plan, validates table/columns against registry,
and pulls filter predicates for pushdown analysis.
Blocks dangerous operations (DROP, DELETE, UPDATE, INSERT, ALTER, CREATE).
"""
import sqlglot
from sqlglot import exp
from dataclasses import dataclass, field
from typing import Optional, List
from queryforge.schema_registry import SchemaRegistry

BLOCKED = (exp.Drop, exp.Delete, exp.Update, exp.Insert,
           exp.Alter, exp.Create, exp.Command)


@dataclass
class LogicalPlan:
    table: str
    select_cols: list
    aggregates: list
    filters: list
    group_by: list
    order_by: list
    limit: Optional[int]
    raw_sql: str
    requires_scatter: bool
    schema_columns: list = field(default_factory=list)
    filter_predicates: list = field(default_factory=list)


def parse_sql(sql: str) -> LogicalPlan:
    registry = SchemaRegistry()
    try:
        ast = sqlglot.parse_one(sql.strip(), dialect="sqlite")
    except Exception as e:
        raise ValueError(f"SQL syntax error: {e}")

    for node in ast.walk():
        if isinstance(node, BLOCKED):
            raise PermissionError(
                f"Operation blocked for safety: {type(node).__name__}. "
                "Only SELECT queries are allowed."
            )

    from_clause = ast.find(exp.From)
    if not from_clause:
        raise ValueError("Missing FROM clause.")
    table_node = from_clause.find(exp.Table)
    if not table_node:
        raise ValueError("Cannot resolve table.")

    table_name = table_node.name.lower()
    table_meta = registry.get_table(table_name)
    known_columns = [c["col_name"] for c in table_meta["columns"]]

    select_cols, aggregates = [], []
    agg_types = (exp.Avg, exp.Sum, exp.Count, exp.Max, exp.Min)
    select_node = ast.find(exp.Select)

    if select_node:
        for expr in select_node.expressions:
            if isinstance(expr, exp.Star):
                select_cols.append("*")
            elif isinstance(expr, agg_types):
                func_name = type(expr).__name__.upper()
                col_node = expr.find(exp.Column)
                col_name = col_node.name if col_node else "*"
                alias = expr.alias or f"{func_name}_{col_name}"
                aggregates.append({"func": func_name, "col": col_name, "alias": alias})
            elif isinstance(expr, exp.Alias):
                inner = expr.this
                if isinstance(inner, agg_types):
                    func_name = type(inner).__name__.upper()
                    col_node = inner.find(exp.Column)
                    col_name = col_node.name if col_node else "*"
                    aggregates.append({"func": func_name, "col": col_name, "alias": expr.alias})
                else:
                    select_cols.append(expr.alias)
            elif isinstance(expr, exp.Column):
                col_name = expr.name
                if col_name not in known_columns and col_name != "*":
                    raise ValueError(
                        f"Column '{col_name}' not in '{table_name}'. Available: {known_columns}"
                    )
                select_cols.append(col_name)

    filters = []
    filter_predicates = []
    where = ast.find(exp.Where)
    if where:
        filters.append(where.this.sql(dialect="sqlite"))
        for cond in where.walk():
            if isinstance(cond, (exp.GT, exp.GTE, exp.LT, exp.LTE, exp.EQ)):
                left = cond.left
                right = cond.right
                if isinstance(left, exp.Column) and isinstance(right, exp.Literal):
                    filter_predicates.append({
                        "col": left.name,
                        "op": type(cond).__name__,
                        "val": right.this,
                    })

    group_by = []
    group = ast.find(exp.Group)
    if group:
        group_by = [e.name for e in group.expressions if isinstance(e, exp.Column)]

    order_by = []
    order = ast.find(exp.Order)
    if order:
        order_by = [e.sql(dialect="sqlite") for e in order.expressions]

    limit_node = ast.find(exp.Limit)
    limit = None
    if limit_node:
        try:
            lit = limit_node.expression
            if lit is None:
                lit = limit_node.this
            limit = int(lit.this) if hasattr(lit, "this") else int(lit.name)
        except (AttributeError, ValueError, TypeError):
            limit = None

    return LogicalPlan(
        table=table_name,
        select_cols=select_cols,
        aggregates=aggregates,
        filters=filters,
        group_by=group_by,
        order_by=order_by,
        limit=limit,
        raw_sql=sql,
        requires_scatter=bool(aggregates),
        schema_columns=known_columns,
        filter_predicates=filter_predicates,
    )
