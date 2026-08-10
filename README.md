# Delivery Log Formatter

A 3-step Bi-Rite Operations tool: **Upload → Review & Edit → Generate**.

Takes the raw "OPS - Print Delivery Log" PDF export, lets you review and fix
anything before printing, then produces the finished PDF:

- Column headers repeated at the top of every page
- A **Stage Time** column (Departure Time minus 30 minutes, rounded to the
  nearest 5 minutes) — editable, with manual overrides respected
- Internal ops notes highlighted yellow when they mention hot food, coffee,
  salsa, boxed meals, HH, alcohol, or bev(s) — the leading item count and
  "bag" stay unhighlighted
- Everything else preserved exactly as parsed, unless you edit it

Parsing is fully deterministic (no AI/LLM calls) — it reads the PDF's column
x-positions directly, so it's fast, free to run, and doesn't send any
customer data to a third party.

## Project layout

```
delivery-log-tool/
├── api/
│   ├── parse.py            # POST /api/parse    — PDF in, structured JSON out
│   ├── generate.py         # POST /api/generate  — edited JSON in, PDF out
│   ├── pipeline.py          # shared parsing / Stage Time / highlight / PDF-build logic
│   └── requirements.txt     # flask, pdfplumber, reportlab
├── components/
│   ├── Chrome.js             # header, step indicator, footer
│   ├── UploadStep.js         # Step 1
│   ├── ReviewStep.js         # Step 2 — editable table
│   └── GenerateStep.js       # Step 3 — summary, download, print
├── lib/
│   └── deliveryLogRules.js   # JS mirror of the highlight/Stage-Time rules (for live preview)
├── styles/
│   └── theme.js              # shared Bi-Rite Operations look (dark navy/teal)
├── pages/
│   └── index.js              # wires the 3 steps together
├── package.json
└── vercel.json
```

## How the workflow works

1. **Upload** — drop the raw PDF. It's sent to `/api/parse`, which parses it
   in-memory (nothing written to disk) and returns structured JSON: one entry
   per 30-minute section header and one per order, each order already carrying
   a computed Stage Time.
2. **Review & Edit** — the parsed data renders as an editable table. Every
   field except Order No. can be edited inline. Editing Departure Time
   auto-recalculates Stage Time (unless you've manually overridden Stage Time
   for that row, in which case it's left alone until Departure changes again).
   Notes show a live yellow-highlight preview matching what the final PDF will
   show. Edited rows get a small dot next to the order number, and a running
   "N manual changes" count is shown. **Reset Changes** restores everything
   from the original parse without re-uploading.
3. **Generate** — sends the current (possibly edited) data to `/api/generate`,
   which validates required fields, builds the PDF the same way as before, and
   returns it. **Download** saves it; **Print** opens the actual generated PDF
   in a hidden frame and triggers the browser's print dialog on it — it never
   prints the web page itself.

## Deploy (same flow as your other tools)

1. Push this folder to a GitHub repo (e.g. `griffinlau/delivery-log-tool`).
2. Import the repo in Vercel — it auto-detects the Next.js frontend and both
   Python functions in `api/`. No manual configuration is needed.
3. Deploy. Open the URL and run a real delivery log through it.

## What changed from the previous single-step version

1. **Files changed:**
   - `api/pipeline.py` — now works entirely in-memory (accepts file-like
     objects, not just paths), and `build_pdf()` now takes a plain
     list-of-dicts so it can build from either a fresh parse or edited/
     round-tripped JSON. Added `is_highlighted()` and `with_stage_times()`
     helpers.
   - `vercel.json` — now registers two Python functions instead of one.
   - `package.json` — Next.js bumped to `14.2.35` (patched; the Dec 2025
     Next.js/React CVEs affect the App Router, which this project doesn't
     use, but there's no reason not to be on the patched version).
   - `pages/index.js` — completely rewritten around the 3-step flow instead
     of a single upload-and-download action.
   - `README.md` — this file.

2. **New files added:**
   - `api/parse.py`, `api/generate.py` (replace the old `api/process.py`)
   - `components/Chrome.js`, `components/UploadStep.js`,
     `components/ReviewStep.js`, `components/GenerateStep.js`
   - `lib/deliveryLogRules.js`
   - `styles/theme.js`

3. **Removed:** `api/process.py` (its two responsibilities — parse and
   generate — are now separate endpoints so the browser can hold the parsed
   data for editing between them).

4. **`requirements.txt`** — unchanged (still just `flask`, `pdfplumber`,
   `reportlab`).

5. **Vercel settings** — nothing to change manually; Vercel reads the updated
   `vercel.json` automatically on the next deploy.

## Testing the new workflow after deploying

1. Open the deployed URL — you should land on Step 1 with the Bi-Rite header,
   date in the upper right, and a single "DELIVERY LOG" drop zone.
2. Drop in a raw delivery log PDF. It should auto-advance to Step 2 within a
   couple of seconds. If you drop a non-PDF, you should see an inline error
   instead of a silent failure.
3. On Step 2, confirm: section header rows (e.g. "7:00 am - 7:30 am") show as
   full-width dividers; notes with trigger words show yellow highlighting;
   editing a Departure Time updates that row's Stage Time automatically;
   editing Stage Time directly and then changing Departure again leaves your
   manual Stage Time alone; the "N manual changes" counter updates as you
   edit; **Reset Changes** reverts everything.
4. Click **Continue to Generate** — Step 3 should show order/window/highlight/
   edit counts, then **Download PDF** and **Print** should both work against
   the actual generated PDF (compare the download against what Print shows —
   they should be identical, and Print should not print the web page itself).
5. Click **Start New Delivery Log** — you should land back on a clean Step 1.

## Notes for future tweaks

- **Highlight keywords** — `HIGHLIGHT_PATTERN` in `api/pipeline.py` (and keep
  `lib/deliveryLogRules.js`'s `HIGHLIGHT_RE` in sync for the live preview).
- **Stage Time offset/rounding** — `compute_stage_time()` in
  `api/pipeline.py` (and `computeStageTime()` in `lib/deliveryLogRules.js`).
- **Column widths / PDF styling** — `COL_WIDTHS`, `HEADERS`, and the
  `TableStyle` in `build_pdf()` in `api/pipeline.py`.
- **Visual theme** (colors, fonts, spacing) — `styles/theme.js`.
- **Bi-Rite logo** — currently a text-based placeholder box in
  `components/Chrome.js` (`logoBox`/`logoText`). Swap in the real logo image
  by replacing that `<div>` with an `<img src="/bi-rite-logo.png" />` and
  dropping the file in a new `public/` folder.
