"""
POST /api/generate   (application/json)
Body: { "title": str, "records": [ {type:'section', label} | {type:'data', ...} ] }

Takes the (possibly hand-edited) structured delivery log the browser has been
holding since /api/parse, validates required fields, and returns the finished
PDF: repeated headers on every page, Stage Time column, highlighted notes.

Nothing is persisted — the PDF is built directly into an in-memory buffer.
"""
import io
import sys
import os

sys.path.append(os.path.dirname(__file__))
from pipeline import build_pdf  # noqa: E402

from flask import Flask, request, jsonify, send_file

app = Flask(__name__)

REQUIRED_FIELDS = ['order_no', 'departure']


@app.route('/api/generate', methods=['POST'])
def generate_route():
    payload = request.get_json(silent=True)
    if not payload or 'records' not in payload:
        return jsonify({'error': 'Missing "records" in request body.'}), 400

    title = payload.get('title') or 'OPS - Print Delivery Log'
    records = payload['records']

    data_rows = [r for r in records if r.get('type') == 'data']
    if not data_rows:
        return jsonify({'error': 'No orders to generate — the delivery log is empty.'}), 422

    problems = []
    for r in data_rows:
        missing = [f for f in REQUIRED_FIELDS if not (r.get(f) or '').strip()]
        if missing:
            problems.append({'order_no': r.get('order_no') or '(blank)', 'missing': missing})
    if problems:
        return jsonify({'error': 'Some rows are missing required fields.', 'rows': problems}), 400

    buf = io.BytesIO()
    try:
        build_pdf(title, records, buf)
    except Exception as e:
        return jsonify({'error': f'Failed to generate PDF: {e}'}), 500
    buf.seek(0)

    return send_file(
        buf,
        mimetype='application/pdf',
        as_attachment=True,
        download_name='delivery-log-formatted.pdf',
    )
