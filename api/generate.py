"""
POST /api/generate   (application/json)
Body: { "title": str, "records": [ {type:'section', label} |
                                    {type:'data'|'pickup', ...} ] }

Takes the (possibly hand-edited) structured delivery log the browser has been
holding since /api/parse, validates required fields, and returns the finished
PDF: repeated headers on every page, Stage Time column, highlighted notes.

Validation only applies to normal delivery rows (type 'data') — Order No. and
Departure Time are required there. Pickup rows (type 'pickup') never require
Delivery Group, Departure Time, or Stage Time, since those fields legitimately
don't apply to a pickup order.

Nothing is persisted — the PDF is built directly into an in-memory buffer.
"""
import io
import sys
import os

sys.path.append(os.path.dirname(__file__))
from pipeline import build_pdf  # noqa: E402

from flask import Flask, request, jsonify, send_file

app = Flask(__name__)

# Required fields per row type. Pickup rows only need an order number —
# Delivery Group / Departure Time / Stage Time are delivery-specific and are
# never required (or calculated) for a pickup.
REQUIRED_FIELDS_BY_TYPE = {
    'data': ['order_no', 'departure'],
    'pickup': ['order_no'],
}

FIELD_LABELS = {
    'order_no': 'Order No.',
    'departure': 'Departure Time',
    'group': 'Delivery Group',
    'stage': 'Stage Time',
}


@app.route('/api/generate', methods=['POST'])
def generate_route():
    payload = request.get_json(silent=True)
    if not payload or 'records' not in payload:
        return jsonify({'error': 'Missing "records" in request body.'}), 400

    title = payload.get('title') or 'OPS - Print Delivery Log'
    records = payload['records']

    order_rows = [r for r in records if r.get('type') in REQUIRED_FIELDS_BY_TYPE]
    if not order_rows:
        return jsonify({'error': 'No orders to generate — the delivery log is empty.'}), 422

    problems = []
    for r in order_rows:
        required = REQUIRED_FIELDS_BY_TYPE[r['type']]
        missing = [f for f in required if not (r.get(f) or '').strip()]
        if missing:
            problems.append({'order_no': r.get('order_no') or '(blank)', 'missing': missing})

    if problems:
        # Build a specific, scannable message — e.g. "Order 83352: Departure
        # Time is missing." — instead of a generic "some rows" sentence, so
        # staff don't have to hunt through the whole sheet to find the issue.
        parts = []
        for p in problems:
            labels = ' and '.join(FIELD_LABELS.get(f, f) for f in p['missing'])
            verb = 'are' if len(p['missing']) > 1 else 'is'
            parts.append(f"Order {p['order_no']}: {labels} {verb} missing.")
        message = ' '.join(parts)
        return jsonify({'error': message, 'rows': problems}), 400

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
