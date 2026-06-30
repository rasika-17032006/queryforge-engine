"""CSV + PDF export of query results."""
import io
import csv
from fpdf import FPDF


def export_csv(rows, columns) -> bytes:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=columns)
    writer.writeheader()
    for r in rows:
        writer.writerow({c: r.get(c, "") for c in columns})
    return buf.getvalue().encode("utf-8")


def export_pdf(rows, columns, title="QueryForge Result") -> bytes:
    pdf = FPDF(orientation="L", unit="mm", format="A4")
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, title, ln=1)
    pdf.set_font("Helvetica", "B", 8)

    if not rows or not columns:
        pdf.cell(0, 8, "No results.", ln=1)
        return bytes(pdf.output())

    n_cols = max(1, len(columns))
    page_w = 277
    col_w = page_w / n_cols

    # Header
    for c in columns:
        pdf.cell(col_w, 6, str(c)[:25], border=1)
    pdf.ln()

    pdf.set_font("Helvetica", size=7)
    # Limit to 200 rows in PDF
    for row in rows[:200]:
        for c in columns:
            val = row.get(c, "")
            pdf.cell(col_w, 5, str(val)[:25], border=1)
        pdf.ln()

    return bytes(pdf.output())
