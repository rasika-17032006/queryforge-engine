"""
AI SQL Copilot: natural language → SQL via Google Gemini API.

Uses google-generativeai (Google's official Python SDK).
Get a free API key from https://aistudio.google.com/apikey and set it as:
    GOOGLE_API_KEY=...   in backend/.env
"""
import os
import re
import google.generativeai as genai

# GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")
# MODEL_NAME = os.environ.get("LLM_MODEL", "gemini-2.5-flash")

GOOGLE_API_KEY = os.getenv("DB_COPILOT_KEY", os.getenv("GOOGLE_API_KEY", ""))
MODEL_NAME  =  os.getenv("DB_COPILOT_MODEL", "gemini-2.5-flash")
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)


def _build_system_prompt(tables_info):
    """tables_info: list of dicts with table_name, columns (each with col_name, sql_type, sample_values)."""
    schema_block = []
    for t in tables_info:
        cols_str = ", ".join(
            f'{c["col_name"]} ({c["sql_type"]})' for c in t["columns"]
        )
        sample_block = []
        for c in t["columns"][:6]:
            sv = c.get("sample_values", "")
            if sv:
                sample_block.append(f'  {c["col_name"]}: e.g. {sv}')
        sample_str = "\n".join(sample_block)
        schema_block.append(
            f'Table: "{t["table_name"]}" ({t["total_rows"]:,} rows)\n'
            f'  Columns: {cols_str}\n'
            f'{sample_str}'
        )
    schema_text = "\n\n".join(schema_block) if schema_block else "(no tables yet)"

    return f"""You are QueryForge SQL Copilot. Convert the user's natural language request into a single SQLite-dialect SQL query.

SCHEMA:
{schema_text}

RULES:
1. Output ONLY the SQL — no markdown, no commentary, no ```sql fences. Just raw SQL ending in a semicolon.
2. Use only SELECT statements. Never DROP, DELETE, UPDATE, INSERT, ALTER, CREATE.
3. Use exact column names and table names from the schema (case-sensitive, no quoting unless needed).
4. Prefer aggregates (COUNT, SUM, AVG, MAX, MIN) and GROUP BY when the user asks about "top", "average", "total", "distribution", "breakdown".
5. Add LIMIT 100 to any non-aggregate query to keep result sets manageable.
6. If multiple tables exist, pick the most relevant one based on the user's question. Do not join unless explicitly asked.
7. If the user's request is ambiguous or refers to columns not in the schema, return: SELECT 'cannot map request to schema' AS error;
"""


async def nl_to_sql(question: str, tables_info: list) -> dict:
    if not GOOGLE_API_KEY:
        return {
            "sql": "",
            "error": "System Configuration Error: DB_COPILOT_KEY environment variable is not established on host machine.",
    
        }

    system_prompt = _build_system_prompt(tables_info)
    try:
        model = genai.GenerativeModel(
            MODEL_NAME,
            system_instruction=system_prompt,
        )
        resp = await model.generate_content_async(question)
        sql_text = (resp.text or "").strip()
        # Strip markdown code fences if model still adds them
        sql_text = re.sub(r"^```(?:sql)?\s*", "", sql_text, flags=re.IGNORECASE)
        sql_text = re.sub(r"\s*```$", "", sql_text)
        return {"sql": sql_text.strip(), "error": None}
    except Exception as e:
        return {"sql": "", "error": str(e)}
