"""
POST /api/parse   (multipart/form-data, field name: "file")
Parses the raw delivery log PDF and returns structured JSON — no PDF is
generated or stored here. Nothing is written to disk; the upload is read
entirely in memory and discarded once the request completes.

Response: { "title": str, "records": [ {type:'section', label} | {type:'data', ...} ] }
"""
import io
import sys
import os

sys.path.append(os.path.dirname(__file__))
from pipeline import parse_delivery_log, with_stage_times, is_highlighted  # noqa: E402

from flask import Flask, request, jsonify

app = Flask(__name__)


@app.route('/api/parse', methods=['POST'])
def parse_route():
    if 'file' not in request.files:
        return jsonify({'error': 'Missing "file" field in form-data.'}), 400

    upload = request.files['file']

    if upload.mimetype not in ('application/pdf', 'application/octet-stream') and \
            not upload.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'Please upload a PDF file.'}), 400

    raw = upload.read()
    if not raw.startswith(b'%PDF'):
        return jsonify({'error': 'That file doesn\u2019t look like a valid PDF.'}), 400

    try:
        title, records = parse_delivery_log(io.BytesIO(raw))
    except Exception as e:
        return jsonify({'error': f'Could not read this PDF: {e}'}), 422

    records = with_stage_times(records)

    order_rows = [r for r in records if r.get('type') in ('data', 'pickup')]
    if not order_rows:
        return jsonify({'error': 'No valid orders were found in this PDF. Double-check '
                                  'it\u2019s the raw OPS Print Delivery Log export.'}), 422

    for r in order_rows:
        r['highlighted'] = is_highlighted(r.get('notes', ''))

    return jsonify({'title': title, 'records': records})
