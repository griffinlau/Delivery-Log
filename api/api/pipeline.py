import re
import datetime as dt
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import pdfplumber

# ---------------------------------------------------------------------------
# 1. PARSE the raw ops-export PDF into structured records
#    Works entirely in-memory — accepts a file path OR a file-like object
#    (e.g. io.BytesIO), so the API layer never has to write the upload to disk.
# ---------------------------------------------------------------------------

BOUNDARIES = [
    (44.5, 'order_no'),
    (99.3, 'contact'),
    (184.4, 'company'),
    (267.7, 'address'),
    (412.6, 'total'),
    (477.0, 'notes'),
    (594.8, 'group'),
    (673.5, 'departure'),
]
SECTION_RE = re.compile(r'^\d{1,2}:\d{2}\s*(am|pm)\s*-\s*\d{1,2}:\d{2}\s*(am|pm)$', re.IGNORECASE)
ORDER_NO_RE = re.compile(r'^\d{4,6}$')
TITLE_RE = re.compile(r'^OPS\s*-\s*Print Delivery Log')


def _col_for(x0):
    col = BOUNDARIES[0][1]
    for bx, name in BOUNDARIES:
        if x0 + 1.5 >= bx:
            col = name
        else:
            break
    return col


def _group_lines(words):
    lines = {}
    for w in words:
        top = round(w['top'], 1)
        key = None
        for k in lines:
            if abs(k - top) <= 1.5:
                key = k
                break
        if key is None:
            key = top
            lines[key] = []
        lines[key].append(w)
    return [lines[k] for k in sorted(lines)]


def parse_delivery_log(path_or_fileobj):
    """Returns (title, [ {type:'section', label} | {type:'data', ...fields} ])"""
    records = []
    title = None
    with pdfplumber.open(path_or_fileobj) as pdf:
        for page in pdf.pages:
            words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
            words.sort(key=lambda w: (w['top'], w['x0']))
            for line in _group_lines(words):
                line.sort(key=lambda w: w['x0'])
                text = ' '.join(w['text'] for w in line)
                if TITLE_RE.match(text):
                    title = text
                    continue
                if text.startswith('Order No.') or text.startswith('Generated'):
                    continue
                if SECTION_RE.match(text):
                    records.append({'type': 'section', 'label': text})
                    continue
                first_word = line[0]
                if _col_for(first_word['x0']) == 'order_no' and ORDER_NO_RE.match(first_word['text']):
                    rec = {'type': 'data', 'order_no': first_word['text'], 'contact': '', 'company': '',
                           'address': '', 'total': '', 'notes': '', 'group': '', 'departure': ''}
                    for w in line[1:]:
                        c = _col_for(w['x0'])
                        if c == 'order_no':
                            continue
                        rec[c] = (rec[c] + ' ' + w['text']).strip()
                    records.append(rec)
                else:
                    if not records or records[-1]['type'] != 'data':
                        continue
                    rec = records[-1]
                    for w in line:
                        c = _col_for(w['x0'])
                        if c == 'order_no':
                            c = 'contact'
                        rec[c] = (rec[c] + ' ' + w['text']).strip()
    return title, records


# ---------------------------------------------------------------------------
# 2. STAGE TIME — 30 min before Departure, rounded to nearest 5 minutes
# ---------------------------------------------------------------------------

def compute_stage_time(departure_str):
    """Returns '' if departure_str can't be parsed instead of raising —
    callers (API layer) decide how to surface that as a validation error."""
    try:
        t = dt.datetime.strptime(departure_str.strip().upper(), '%I:%M %p')
    except (ValueError, AttributeError):
        return ''
    staged = t - dt.timedelta(minutes=30)
    minute = staged.minute
    rounded_minute = 5 * round(minute / 5)
    staged = staged.replace(minute=0) + dt.timedelta(minutes=rounded_minute)
    return staged.strftime('%I:%M %p').lower()


# ---------------------------------------------------------------------------
# 3. HIGHLIGHT internal ops notes
# ---------------------------------------------------------------------------

HIGHLIGHT_PATTERN = re.compile(r'\b(?:hot food|boxed meals|salsa|coffee|hh|alcohol|bevs?)\b', re.IGNORECASE)
EXCLUDE_PATTERN = re.compile(r'\d+\s*items?,?\s*|bag,?\s*', re.IGNORECASE)


def is_highlighted(notes):
    return bool(HIGHLIGHT_PATTERN.search(notes or ''))


def highlight_notes(text):
    """Returns reportlab-flavored markup (<font backColor="yellow">) used at PDF-build time."""
    if not HIGHLIGHT_PATTERN.search(text):
        return text
    out = []
    pos = 0
    for m in EXCLUDE_PATTERN.finditer(text):
        if m.start() > pos:
            out.append(f'<font backColor="yellow">{text[pos:m.start()]}</font>')
        out.append(text[m.start():m.end()])
        pos = m.end()
    if pos < len(text):
        out.append(f'<font backColor="yellow">{text[pos:]}</font>')
    return ''.join(out)


# ---------------------------------------------------------------------------
# 4. GENERATE the finished PDF (header repeats on every page automatically)
#    Accepts a plain list-of-dicts (as returned by parse_delivery_log, or as
#    edited/round-tripped through the browser) and an output path OR a
#    file-like object (e.g. io.BytesIO) so no disk write is required.
# ---------------------------------------------------------------------------

styles = getSampleStyleSheet()
cell_style = ParagraphStyle('cell', parent=styles['Normal'], fontSize=8, leading=10)
right_style = ParagraphStyle('r', parent=cell_style, alignment=2)
header_style = ParagraphStyle('header', parent=styles['Normal'], fontSize=8, leading=10, fontName='Helvetica-Bold')
section_style = ParagraphStyle('section', parent=styles['Normal'], fontSize=8, leading=10, fontName='Helvetica-Bold')
title_style = ParagraphStyle('title', parent=styles['Normal'], fontSize=17, leading=20, fontName='Helvetica-Bold')

PAGE_W, PAGE_H = landscape(letter)
MARGIN = 0.4 * inch
COL_WIDTHS = [0.55*inch, 1.15*inch, 1.0*inch, 1.75*inch, 0.62*inch, 1.95*inch, 0.55*inch, 0.68*inch, 0.6*inch]
HEADERS = ["Order No.", "Contact Name", "Company", "Delivery Address", "Order Total $",
           "Internal ops notes", "Delivery Group", "Departure\nTime", "Stage\nTime"]


def _esc(s):
    return (s or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def _P(text, style=cell_style):
    return Paragraph(text, style)


def build_pdf(title, records, out):
    """out may be a filesystem path (str) or a file-like object (e.g. io.BytesIO)."""
    rows = [[_P(h, header_style) for h in HEADERS]]
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E4E4E4')),
        ('LINEBELOW', (0, 0), (-1, 0), 0.75, colors.HexColor('#BBBBBB')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]
    r = 1
    for rec in records:
        if rec.get('type') == 'section':
            rows.append([_P(_esc(rec.get('label', ''))), '', '', '', '', '', '', '', ''])
            style_cmds.append(('SPAN', (0, r), (-1, r)))
            style_cmds.append(('BACKGROUND', (0, r), (-1, r), colors.HexColor('#EEEEEE')))
            style_cmds.append(('FONTNAME', (0, r), (-1, r), 'Helvetica-Bold'))
            r += 1
        else:
            # Prefer an explicit 'stage' value (may be user-edited/overridden);
            # fall back to computing it from departure if absent.
            stage = rec.get('stage')
            if stage is None or stage == '':
                stage = compute_stage_time(rec.get('departure', ''))
            notes_raw = _esc(rec.get('notes', ''))
            rows.append([
                _P(_esc(rec.get('order_no', ''))), _P(_esc(rec.get('contact', ''))),
                _P(_esc(rec.get('company', ''))), _P(_esc(rec.get('address', ''))),
                _P(_esc(rec.get('total', '')), right_style), _P(highlight_notes(notes_raw)),
                _P(_esc(rec.get('group', ''))), _P(_esc(rec.get('departure', ''))), _P(_esc(stage)),
            ])
            r += 1

    t = Table(rows, colWidths=COL_WIDTHS, repeatRows=1)
    t.setStyle(TableStyle(style_cmds))

    def header_footer(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(colors.HexColor('#555555'))
        canvas.drawString(MARGIN, 0.3 * inch, f"Generated {dt.datetime.now().strftime('%d %b %Y, %I:%M %p')}")
        canvas.drawRightString(PAGE_W - MARGIN, 0.3 * inch, f"Page {doc.page}")
        canvas.restoreState()

    doc = BaseDocTemplate(out, pagesize=landscape(letter), leftMargin=MARGIN, rightMargin=MARGIN,
                           topMargin=0.35 * inch, bottomMargin=0.5 * inch)
    frame = Frame(MARGIN, 0.5 * inch, PAGE_W - 2 * MARGIN, PAGE_H - 0.35 * inch - 0.5 * inch, id='normal')
    doc.addPageTemplates([PageTemplate(id='main', frames=[frame], onPage=header_footer)])

    story = [Paragraph(_esc(title) or 'OPS - Print Delivery Log', title_style), Spacer(1, 8), t]
    doc.build(story)


# ---------------------------------------------------------------------------
# Convenience: attach stage times to freshly-parsed records (used by /api/parse)
# ---------------------------------------------------------------------------

def with_stage_times(records):
    out = []
    for rec in records:
        if rec.get('type') == 'data':
            rec = dict(rec)
            rec['stage'] = compute_stage_time(rec.get('departure', ''))
            rec['stage_manual'] = False
        out.append(rec)
    return out
