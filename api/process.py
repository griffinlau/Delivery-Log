"""
Vercel Python Serverless Function (Flask/WSGI - Vercel's supported pattern)
POST /api/process   (multipart/form-data, field name: "file")
-> returns the finished PDF: repeated column headers on every page,
   a computed Stage Time column, and highlighted internal ops notes.
"""
import os
import sys
import tempfile

sys.path.append(os.path.dirname(__file__))
from pipeline import process  # noqa: E402

from flask import Flask, request, send_file, jsonify

app = Flask(__name__)


@app.route('/api/process', methods=['POST'])
def process_route():
    if 'file' not in request.files:
        return jsonify({'error': 'Missing "file" field in form-data.'}), 400

    upload = request.files['file']

    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as in_tmp:
        upload.save(in_tmp.name)
        in_path = in_tmp.name
    out_path = in_path.replace('.pdf', '_out.pdf')

    try:
        process(in_path, out_path)
    except Exception as e:
        return jsonify({'error': f'Failed to process PDF: {e}'}), 500
    finally:
        if os.path.exists(in_path):
            os.unlink(in_path)

    return send_file(
        out_path,
        mimetype='application/pdf',
        as_attachment=True,
        download_name='delivery-log-formatted.pdf',
    )
