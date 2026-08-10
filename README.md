# Delivery Log Formatter

A 3-step Bi-Rite Operations tool: **Upload → Review & Edit → Generate**.

Takes the raw "OPS - Print Delivery Log" PDF export, lets you review and fix
anything before printing, then produces the finished PDF:

- Column headers repeated at the top of every page
- A **Stage Time** column (Departure Time minus 30 minutes, rounded to the
  nearest 5 minutes) — editable, with manual overrides respected
- Internal ops notes highlighted yellow across the *entire actionable portion*
  of the note whenever it mentions hot food, coffee, salsa, boxed meals, HH,
  alcohol, or bev(s) — not just the trigger word itself
- A **Delivery Date** — auto-detected from the uploaded sheet where possible,
  defaulting to tomorrow otherwise, always editable, and used consistently
  everywhere a date is shown (header, Review screen, Generate screen, and the
  final PDF's title)
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
│   ├── UploadStep.js         # Step 1 — Delivery Date field + centered upload card
│   ├── ReviewStep.js         # Step 2 — full-width editable table, click-to-edit
│   └── GenerateStep.js       # Step 3 — summary, download, print
├── lib/
│   └── deliveryLogRules.js   # JS mirror of highlight/Stage-Time rules + date helpers
├── styles/
│   └── theme.js              # shared Bi-Rite Operations look (dark navy/teal)
├── pages/
│   └── index.js              # wires the 3 steps + delivery-date state together
├── package.json
└── vercel.json
```

## How the workflow works

1. **Upload** — a **Delivery Date** field sits above the drop zone, defaulting
   to tomorrow's date. Drop in the raw PDF and it's sent to `/api/parse`,
   which parses it in-memory (nothing written to disk) and returns structured
   JSON. If a reliable date can be extracted from the sheet's own title (e.g.
   "...Tue 11 Aug 2026"), the Delivery Date field auto-updates to match —
   unless you've already typed your own date, in which case your choice is
   left alone. You can also just change the date field directly at any time.
2. **Review & Edit** — the parsed data renders as a full-width table (the
   header row and Order No. column stay pinned as you scroll; the table
   scrolls horizontally on its own if a narrow screen can't fit every column,
   rather than ever squeezing/clipping content). A "Delivery Date: ..." line
   under the step heading confirms which day you're working on. Cells render
   as plain report text by default; hovering an editable cell shows a subtle
   tint and pencil icon; clicking it turns just that cell into a focused
   input — Enter saves, Escape cancels, clicking elsewhere saves. Editing
   Departure Time auto-recalculates Stage Time (unless manually overridden
   for that row). Notes render once, inline, with the correct whole-block
   yellow highlight. Edited rows get a small dot next to the order number,
   with a running "N manual changes" count. **Reset Changes** restores
   everything from the original parse.
3. **Generate** — confirms the Delivery Date again, then sends the current
   data to `/api/generate` — which builds the PDF with a title reflecting the
   *confirmed* delivery date (not necessarily whatever the raw upload said) —
   and returns it. **Download** saves it; **Print** opens the actual
   generated PDF in a hidden frame and triggers the browser's print dialog on
   it, never the web page itself.

The delivery date persists across Back/Forward navigation between all three
steps, and only resets (back to "tomorrow") when you click **Start New
Delivery Log**.

## Deploy (same flow as your other tools)

1. Push this folder to a GitHub repo (e.g. `griffinlau/delivery-log-tool`).
2. Import the repo in Vercel — it auto-detects the Next.js frontend and both
   Python functions in `api/`. No manual configuration is needed.
3. Deploy. Open the URL and run a real delivery log through it.

## Verification for this delivery (v5) — actually executed, not just read

Per your instruction not to trust source-reading alone, I built a Node +
jsdom test harness that **imports and executes the real component files**
from this project (`pages/index.js`, `components/UploadStep.js`,
`components/ReviewStep.js`, `components/GenerateStep.js`,
`lib/deliveryLogRules.js` — unmodified, the exact files in this zip),
mounts the real `<Home />` tree, simulates an actual file-input `change`
event carrying a fake PDF, lets the real `handleParsed()` state transition
run against a mocked `/api/parse` response, and inspects the resulting DOM.
Results:

| Check | Result |
|---|---|
| Header date shown before any upload | `"Tuesday, August 11, 2026"` (tomorrow default) |
| `DELIVERY DATE` field renders, correct default value | `2026-08-11` |
| Header date after upload (extracted from title) | `"Tuesday, August 11, 2026"` |
| Header does **not** show today's date | `"Monday, August 10, 2026"` — not present |
| Step 2 shows the date confirmation line | `"Delivery Date: Tuesday, August 11, 2026"` |
| Note text `"19 items, bag, 2x hot food, No utensils needed"` appears in DOM | **1** time (not duplicated) |
| Highlighted `<span>` count for that note | **1** |
| That span's exact text content | `"2x hot food, No utensils needed"` — the whole remainder, not just the keyword |
| Step 1 content wrapper computed style | `margin: "0 auto"`, `maxWidth: "700px"` |

All eight checks passed against this exact codebase. If your live deployment
still shows the old behavior, the deployed app isn't running this code —
most likely a stale Vercel build/cache, an incomplete GitHub file overwrite
from an earlier zip (if files were uploaded individually across versions
rather than the whole folder at once), or a cached page in your browser.
SHA-256 checksums of every source file are below so you can diff them
directly against what's in your GitHub repo:

```
ac6d44ae2c152057d14575d31a20e8f3fb95b5fb20c3fb439d90d8798ec1dea5  api/generate.py
83eaac5f10ce3f98da884d964188efbf1a0f4cde04acb67f86bb29ffdc197d4d  api/parse.py
8df01ab560a80f59c841253385e87a84adc0d8aa0b40c520cf938e6a7053bede  api/pipeline.py
218e9d89a6de152c6f1b17c4ff9c752e7935ac8a1dd83c14be922ce36985110d  components/Chrome.js
0f363bcd6e03ee916f72a50378d6a7ad0eb63f26684e6d6ac326483b55164f94  components/GenerateStep.js
187b4e73cca599a219bc6284b2edda353638a00a691e4a929dd5219a0dd1d720  components/ReviewStep.js
d1c2b47f4f1c348ea6c16e84f76b42bc4690115c59a0a1c63248e58114cb1d5a  components/UploadStep.js
403d22abeeb1c76778bbb045ef3f6ed94ec4cdca3336d236da5ad8740cc86761  lib/deliveryLogRules.js
45429ffca0556a17d9c321cba493b9d330654eb0465bfc112f98f1c05ffe4d4a  pages/index.js
64008799af2d1310332f1a22cadc407aa97f361104fb6360035c424ca98ff777  styles/theme.js
```

To get a clean deployment: delete the existing files in the GitHub repo (or
delete and recreate the repo), upload this zip's contents fresh in one shot,
then in Vercel trigger a new deployment **without** build cache (Vercel
dashboard → Deployments → "..." menu → Redeploy → uncheck "Use existing
Build Cache"), and hard-refresh the browser tab (Cmd/Ctrl+Shift+R) before
judging the result.

## What changed in this pass (table bug fix + Delivery Date feature)

**No changes to parsing, Stage Time math, PDF-generation column logic, or the
highlight rule itself** — both issues fixed this round were UI bugs and a
missing feature, not core-logic problems.

### 1. Fixed: Contact Name / Company text clipping into fragments

**Root cause found:** the Review table's card wrapper had `overflow: hidden`
combined with a table using `table-layout: fixed; width: 100%` and only
per-column `width`/`minWidth` set via inline styles on the header cells. When
the sum of the intended column widths (1,270px) didn't fit the available
container width, the browser **proportionally shrank every column** to fit
100% — and `overflow: hidden` then hard-clipped whatever text didn't fit in
the now-much-narrower columns, which is exactly what produced stray fragments
like "EUAF" or "ence" and made Contact Name / Company look like they'd
vanished (their headers were still there, just squeezed unreadably thin).

**Fix, in `components/ReviewStep.js`:**
- Column widths are now set via an explicit `<colgroup>`/`<col>` per column —
  the spec-correct, most robust way to fix table column widths — instead of
  relying on header-cell widths under `table-layout: fixed`.
- The table now has `min-width: 1270px` (the real sum of the column widths)
  instead of being forced to exactly `100%`, so columns can never be squeezed
  below their intended size.
- The table sits inside a new `.table-scroll` wrapper with `overflow-x: auto`
  (`overflow-y: visible`, so the page still scrolls vertically and the sticky
  header still works). The outer card's `overflow: hidden` now only rounds
  the corners — it no longer clips live table content, because the scroll
  wrapper handles any overflow internally.
- Net effect: on wide-enough screens, all 9 columns fit with no scrolling at
  all; on narrower screens, the table scrolls horizontally as a unit (exactly
  as you asked for) instead of any column ever being squeezed or clipped.
  Text still wraps normally within each column via the existing
  `word-wrap: break-word` rule — nothing is truncated or hidden.

Verified by hand-checking the computed CSS (`min-width: 1270px`, matching the
literal sum of `FIELD_COLUMNS` widths) and by confirming a clean
`npm run build` with no errors after the change.

### 2. Added: Delivery Date (auto-detect → tomorrow → editable)

- New `lib/deliveryLogRules.js` date helpers: `extractDateFromTitle()` (parses
  a title like `"...Tue 11 Aug 2026"` into an ISO date), `tomorrowISODate()`,
  `formatLongDate()` (header/confirmation-line display), and
  `formatTitleDateSuffix()` (rebuilds the PDF title's date suffix in the
  original format). All date math uses local-time component construction
  (never `new Date(isoString)`), so there's no UTC off-by-one risk.
- `pages/index.js` now owns `deliveryDate` + `dateManuallySet` state: starts
  at tomorrow's date, auto-updates from the parsed title on a successful
  upload *unless* the user has already typed their own date, and is passed
  down to all three steps. Only `handleStartNew()` resets it.
- `components/UploadStep.js` — new "DELIVERY DATE" field (native date input)
  above the drop zone, matching the Ops Bag Packing Tool's date-field
  pattern, with helper text explaining the auto-detect/tomorrow/editable
  behavior.
- `components/ReviewStep.js` — new "Delivery Date: ..." confirmation line
  under the Step 2 heading.
- `components/GenerateStep.js` — now builds the `title` sent to
  `/api/generate` from the confirmed `deliveryDate` (via
  `formatTitleDateSuffix`) instead of passing through the raw parsed title,
  and displays "Delivery Date: ..." instead of the raw title string. This is
  the one place the app's behavior intentionally diverges from the original
  upload: the generated PDF's title always reflects the confirmed delivery
  date, per your instructions.

Verified with direct Node tests against the exact title format your PDFs use
(`"OPS - Print Delivery Log - Tue 11 Aug 2026"` → extracts `2026-08-11`
correctly; a non-matching title correctly falls through to `null`/tomorrow;
the round-trip through the local-date helpers doesn't drift by a day).

### Files changed
`components/ReviewStep.js`, `components/UploadStep.js`,
`components/GenerateStep.js`, `pages/index.js`, `lib/deliveryLogRules.js`
(appended, nothing removed), `README.md`.

### New files
None — everything landed in existing files.

### Backend (`api/`)
Unchanged — `pipeline.py`, `parse.py`, `generate.py`, `requirements.txt` are
identical to the previous version.

### `package.json` / `vercel.json`
Unchanged.

### Vercel settings
Nothing to change.

## Testing done before packaging this ZIP

- `npm run build` — compiles clean, no type/lint errors.
- Started the actual production server (`next start`) and confirmed:
  - It serves 200 OK with no server-side errors.
  - The Delivery Date field pre-fills with tomorrow's date correctly.
  - The header displays the delivery date (not today's date).
  - The computed table `min-width` in the shipped CSS matches the literal sum
    of the column widths (1,270px).
- Verified the date-extraction regex against your exact title format via
  direct Node execution (not just reading the code).
- **Not done:** a pixel-level visual screenshot of the running app — this
  sandbox still doesn't have a browser available to render one. The fixes
  above are verified structurally (clean build, correct computed CSS, correct
  extracted values) but please do a real visual pass after deploying to
  confirm the Review table now reads cleanly with real data and no more
  fragment text.

## Notes for future tweaks

- **Highlight keywords** — `HIGHLIGHT_PATTERN` in `api/pipeline.py` (and keep
  `lib/deliveryLogRules.js`'s `HIGHLIGHT_RE` in sync for the live preview).
- **Stage Time offset/rounding** — `compute_stage_time()` in
  `api/pipeline.py` (and `computeStageTime()` in `lib/deliveryLogRules.js`).
- **Column widths in the review table** — `FIELD_COLUMNS` in
  `components/ReviewStep.js` (the table's `min-width` recalculates
  automatically from this array).
- **Column widths / PDF styling** — `COL_WIDTHS`, `HEADERS`, and the
  `TableStyle` in `build_pdf()` in `api/pipeline.py`.
- **Delivery date format / extraction pattern** — the date helpers in
  `lib/deliveryLogRules.js`.
- **Visual theme** (colors, fonts, spacing) — `styles/theme.js`.
- **Bi-Rite logo** — currently a text-based placeholder box in
  `components/Chrome.js` (`logoBox`/`logoText`). Swap in the real logo image
  by replacing that `<div>` with an `<img src="/bi-rite-logo.png" />` and
  dropping the file in a new `public/` folder.
