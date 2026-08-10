# Delivery Log Formatter

Drag-and-drop tool that takes the raw "OPS - Print Delivery Log" PDF export and returns
the finished version:

- Column headers repeated at the top of every page
- A **Stage Time** column added (Departure Time minus 30 minutes, rounded to the nearest 5 minutes)
- Internal ops notes highlighted yellow when they mention hot food, coffee, salsa, boxed meals,
  HH, alcohol, or bev(s) — the leading item count and "bag" are left unhighlighted
- Everything else (order data, page structure) preserved as-is

The parsing is fully deterministic — it reads the exact column x-positions from the PDF
(no AI/LLM calls, no API costs), so it's fast and free to run. It will keep working as long
as the source report keeps the same column layout. If the export format ever changes, the
column x-positions in `api/pipeline.py` (`BOUNDARIES`) may need a one-time update.

## Project layout

```
delivery-log-tool/
├── api/
│   ├── process.py       # Vercel Python function (Flask) — POST /api/process
│   ├── pipeline.py       # parsing + Stage Time + highlighting + PDF generation
│   └── requirements.txt  # flask, pdfplumber, reportlab
├── pages/
│   └── index.js           # drag-and-drop frontend
├── package.json
└── vercel.json
```

## Deploy (same flow as your other tools)

1. Create a new GitHub repo (e.g. `griffinlau/delivery-log-tool`) and push this folder to it.
2. Import the repo in Vercel ("Add New Project").
3. Vercel auto-detects the Next.js frontend and the Python function in `api/` — no extra
   config needed. Click Deploy.
4. Open the deployed URL, drag in a raw delivery log PDF, and the formatted PDF downloads
   automatically.

## Local testing (optional)

```bash
npm install
npm run dev
```

The Python function needs a Python 3.9+ environment with the packages in
`api/requirements.txt` installed locally if you want to hit `/api/process` from `next dev`
(Vercel's CLI — `vercel dev` — handles this automatically and is the easiest way to test
both pieces together locally).

## Making future tweaks

Same review workflow as your other tools: ask Claude for the changed code block only
(not a full rewrite), then apply it by hand via the GitHub web editor. The main levers:

- **Highlight keywords** — `HIGHLIGHT_PATTERN` in `api/pipeline.py`
- **Stage Time offset/rounding** — `compute_stage_time()` in `api/pipeline.py`
- **Column widths / styling** — `COL_WIDTHS`, `HEADERS`, and the `styles`/`TableStyle` in
  `build_pdf()` in `api/pipeline.py`
