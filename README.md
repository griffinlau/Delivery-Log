# Delivery Log Formatter

A 3-step Bi-Rite Operations tool: **Upload → Review & Edit → Generate**.

Takes the raw "OPS - Print Delivery Log" PDF export, lets you review and fix
anything before printing — including manually overriding note highlighting —
then produces the finished PDF.

## Features

- Column headers repeated at the top of every page
- **Delivery Date**: auto-detected from the uploaded sheet where possible,
  defaults to tomorrow otherwise, always editable, used consistently in the
  header, Review screen, Generate screen, and the final PDF's title
- **Stage Time** (Departure Time minus 30 minutes, rounded to the nearest 5
  minutes) — editable, with manual overrides respected, never calculated for
  pickup orders
- **Pickup order support**: primarily detected via a literal standalone
  "Pick Ups" heading in the source PDF — orders listed after it are
  classified as pickups directly, and the heading is preserved as its own
  divider in the Review screen and the final PDF. A secondary fallback also
  recognizes a row as a pickup from its own values (literal "Pickup" in
  Delivery Group, or literal "N/A" in Departure Time) for export formats
  that represent it that way instead. Pickup rows never require Delivery
  Group, Departure Time, or Stage Time, and never get fake placeholder
  values for those fields — whatever the source actually contains (or
  doesn't) is preserved as-is.
- **Live reclassification**: editing a row's Delivery Group to "Pickup", or
  its Departure Time to "N/A", immediately reclassifies it in the Review
  screen. Drag-and-drop reordering between sections is also supported,
  purely for repositioning (it no longer changes
  a row's delivery/pickup classification — that's determined by its values).
- **Note highlighting**: the entire actionable portion of a note (everything
  after "N items, bag,") is highlighted yellow when it mentions hot food,
  coffee, salsa, boxed meals, HH, alcohol, bev(s), or snack pack(s) —
  **manually overridable per row** (Auto / On / Off) via a hover icon
- Click-to-edit cells, Reset Changes, a running manual-change count, and
  specific validation error messages (e.g. "Order 83352: Departure Time is
  missing") instead of a generic error
- Deterministic parsing — no AI/LLM calls, ever; the column parser adapts to
  whatever header row it encounters rather than assuming one fixed layout
- Download and Print (prints the actual generated PDF, never the web page)

## Project layout

```
delivery-log-tool/
├── api/
│   ├── parse.py            # POST /api/parse    — PDF in, structured JSON out
│   ├── generate.py         # POST /api/generate  — edited JSON in, PDF out
│   ├── pipeline.py          # parsing / Stage Time / highlight / PDF-build logic
│   └── requirements.txt     # flask, pdfplumber, reportlab
├── components/
│   ├── Chrome.js             # header, step indicator, footer
│   ├── UploadStep.js         # Step 1 — Delivery Date field + centered upload card
│   ├── ReviewStep.js         # Step 2 — editable table, drag-and-drop, highlight override
│   └── GenerateStep.js       # Step 3 — summary, download, print
├── lib/
│   └── deliveryLogRules.js   # JS mirror of highlight/Stage-Time rules + date helpers
├── styles/
│   └── theme.js              # shared Bi-Rite Operations look (dark navy/teal)
├── pages/
│   └── index.js              # wires the 3 steps + delivery-date state together
├── package.json
└── vercel.json               # do NOT pin a Python runtime here — see below
```

## ⚠️ Vercel config — do not pin a Python runtime

`vercel.json` must stay as:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json"
}
```

An earlier version pinned `"runtime": "@vercel/python@4.3.0"`, which broke
deployment — when that build fails, Vercel keeps serving the last
*successful* deploy, so it can look like new fixes "aren't showing up" when
really the build is just failing silently in the background. Let Vercel
auto-detect the Python functions in `api/` instead.

## How the parser works (and why it's robust to layout changes)

Column positions are **not** hardcoded to one fixed layout. `api/pipeline.py`
detects column-header rows dynamically wherever they appear (by recognizing
label phrases like "Order No.", "Contact Name", "Pick up Address", "Order
Total $", etc. — see `LABEL_PHRASES`) and rebuilds the field boundaries from
that row's actual word positions. This is what lets it correctly handle:

- The main delivery table's header (8 columns).
- A later "Pick Ups" header with a different, shorter set of columns (no
  Delivery Group / Departure Time).
- Labels that wrap across two visual lines (e.g. "Departure" / "Time" as
  separate lines) — single-word fallback phrases catch these.

A standalone "Pick Ups" line (case-insensitive, tolerates "Pickups" /
"Pick-Ups") flips subsequent order rows to `type: 'pickup'` until the end of
the document (or another Pick Ups marker, for future exports that might have
more than one).

## Drag-and-drop reclassification

Each order row has a drag handle (⠿). Dragging a row and dropping it onto a
different section (a delivery time-window divider, the Pick Ups divider, or
between existing rows) reclassifies it:

- Dropped into the Pick Ups block → becomes `type: 'pickup'` (Delivery
  Group/Departure/Stage Time no longer required; shown as "—" if blank).
- Dropped into a delivery section → becomes `type: 'data'` (normal
  validation applies again).
- Existing field values are **not** auto-cleared on a move — edit them
  manually if they no longer apply once reclassified.
- A small teal "P" tag next to the order number marks any row currently
  classified as a pickup, regardless of which section it's sitting under.
- Counts as a manual change, works with Reset Changes, and the `type` sent
  to `/api/generate` determines which section it prints under in the PDF.

Edit-tracking (`isRowEdited` / the manual-change counter) matches rows
between `records` and `originalRecords` by **order number**, not array
position — a drag reorder changes position without breaking "was this row
edited?" detection. See `findOriginal()` in `components/ReviewStep.js`.

## Deploy

1. Delete the existing files in your GitHub repo (or delete/recreate it) and
   upload this zip's contents fresh, all at once — don't merge individual
   files across versions.
2. Import/redeploy in Vercel. Use Deployments → "..." → Redeploy and uncheck
   "Use existing Build Cache" if redeploying an existing project.
3. Hard-refresh the browser tab (Cmd/Ctrl+Shift+R) before judging the result.

## Change history

**Real Pick Ups data + drag-and-drop + snack pack highlighting.** Tested
against the actual uploaded PDF (not synthetic data) and found a real
regression: the dynamic header-detection from the previous pass required a
label's words to be on the same visual line, but this report wraps
"Departure" and "Time" onto two lines, so every departure time was silently
merging into Delivery Group. Fixed with single-word fallback label phrases.
Added "snack pack(s)" to the highlight keyword list. Added drag-and-drop so
any row can be manually moved between delivery/pickup sections, which
required switching edit-tracking from positional to identity-based
(order-number) matching. See Testing below for what was actually verified.

**Pick Ups section support + specific validation errors.** Parser now
detects a "Pick Ups" divider and classifies those rows separately — no
Delivery Group / Departure / Stage Time required or calculated, no fake
placeholder values. Validation errors now name the specific order and field
(e.g. "Order 83352: Departure Time is missing") instead of a generic
message. Column-boundary detection became dynamic (per encountered header
row) rather than one hardcoded layout, to support the Pick Ups table's
different columns.

**Fixed the Step 2 navigation bar.** Switched from `position: sticky` to
`position: fixed` for the Back/Reset/Continue bar — sticky only pins within
its own containing block, which turned out to only show the bar once
scrolled to the very bottom. Fixed positioning pins to the viewport
unconditionally.

**Highlight overrides (Auto/On/Off) + Vercel fix.** Added a per-row manual
override for note highlighting, accessible via a hover icon on the notes
cell. Found and fixed the root cause of "my fixes aren't showing up on the
live site" — a pinned Python runtime in `vercel.json` that broke deployment.

**Table layout fix + Delivery Date.** Fixed a real bug where the review
table's `overflow: hidden` combined with `table-layout: fixed; width: 100%`
caused columns to be proportionally squeezed and then hard-clipped when
content didn't fit, producing stray text fragments. Switched to
`<colgroup>`-enforced widths with a horizontal-scroll fallback. Added the
Delivery Date feature (auto-detect → tomorrow default → always editable).

**UI/UX polish pass.** Centered Step 1, widened Step 2 to use most of the
viewport instead of a cramped inner scrollbox, switched notes editing to
click-to-edit (fixing a duplicated-note-rendering bug), and general visual
polish to match the Coffee Brew Schedule / Ops Bag Packing Tool look.

**3-step redesign.** Rebuilt the original single-step upload-and-download
tool into the current Upload → Review & Edit → Generate flow with an
editable table, matching the Bi-Rite Operations dark navy/teal visual
language.

**Original tool.** Deterministic PDF parsing (pdfplumber) + PDF generation
(reportlab): repeated headers on every page, computed Stage Time column,
and keyword-based note highlighting.

## Testing actually executed for the current version

All of the following was run against the **actual uploaded PDF**
(`OPS_-_Print_Delivery_Log_20260812120738.pdf`, 69 records including a real
Pick Ups section), executing the real code — not inferred from reading it:

- **Parser, before and after the fix**: ran `parse_delivery_log()` directly
  against the real file. Before the fix, reproduced the exact bug (Group
  absorbing Departure Time, e.g. `group: "Nash 06:41 am"`, `departure: ""`).
  After the fix, spot-checked 7 previously-broken rows plus the Pick Ups row
  — every one now has Group and Departure Time correctly separated, and
  order 82819 (Ruthie Young, "Wholesale Pick Up Order") parses with
  genuinely blank Group/Departure/Stage.
- **Snack Pack highlighting**: confirmed `is_highlighted()` /
  `render_notes_markup()` now flag and highlight "6x Snack Pack".
- **Full interactive drag-and-drop test** (Node + jsdom executing the real
  component files against the real parsed data, not mocks): uploaded the
  actual file, confirmed the Pick Ups section and highlighted Snack Pack
  note render correctly, dragged a genuine delivery row (order 83097,
  Margaret O'Shea) onto the Pick Ups divider, and confirmed the pickup tag
  appears, the manual-change counter updates, **Reset Changes** correctly
  reverts it, and re-doing the drag through to Generate produces a payload
  with `type: "pickup"` for that row with no validation error.
  - Caught and fixed a real bug of my own during this: dropping directly
    onto a divider was inserting the row *before* it instead of *after* it
    as the section's first item — the interactive test caught this
    (the type didn't flip) before it shipped.
- **Rendered the resulting PDF to an image** and visually confirmed Margaret
  O'Shea's row appears correctly under "Pick Ups" with Stage Time blank and
  "6x Snack Pack" highlighted.
- `npm run build` — compiles clean, no errors or warnings.

## What's new in this pass (fixed the Pick Ups regression + snack pack)

**Root cause found and fixed — this was a real regression I introduced, not
an edge case in your data.**

### What went wrong

The previous "Pick Ups section" architecture assumed the source PDF had a
separately-shaped table for pickups (different columns, its own header row),
so I added dynamic header-boundary re-detection to handle that. Two things
were wrong with that:

1. **Your real data doesn't have a separate table at all.** Pickup orders
   live in the exact same 9-column table as deliveries — Image 1 you sent
   confirms row 82819 has all the normal columns, just with the literal
   text `Pickup` in Delivery Group and `N/A` in Departure Time, not blank or
   differently-shaped fields.
2. **The dynamic header re-detection was corrupting unrelated rows.** Your
   Image 3 showed Margaret O'Shea's row — nowhere near the Pick Ups area —
   with "Nash" bled into her notes field. That's exactly why "Snack Pack"
   wasn't highlighting: the text no longer matched cleanly, because the row
   itself was already corrupted upstream of the highlight logic.

### The fix

- **Reverted the parser** to the original fixed-boundary column detection
  (`BOUNDARIES` in `api/pipeline.py`) — the exact logic that was extensively
  validated earlier in this project. Removed `_detect_header_boundaries`
  and `LABEL_PHRASES` entirely; they're gone, not just unused.
- **Replaced section-based pickup detection with value-based classification.**
  A new `_classify_row()` runs *after* normal parsing completes (so wrapped
  continuation lines are already assembled): a row becomes `type: 'pickup'`
  if its own Delivery Group reads "Pickup" (case-insensitive) or its
  Departure Time reads "N/A" (`PICKUP_GROUP_RE` / `NA_RE`). Otherwise it's
  `type: 'data'`, same as always.
- **Removed the obsolete `pickup_section` record type** everywhere — the
  backend no longer emits it, and the frontend no longer has a
  drag-and-drop-triggered auto-reclassification tied to a "Pick Ups"
  divider (since there isn't one). Dragging a row to reorder it now just
  reorders it — it no longer changes what type the row is.
- **Added live reclassification in the Review screen**
  (`lib/deliveryLogRules.js`'s `classifyRowType()`, wired into
  `updateField()` in `components/ReviewStep.js`): editing a row's Delivery
  Group to "Pickup" or Departure Time to "N/A" immediately reclassifies it
  as a pickup — mirroring the backend's rule exactly, so a manual correction
  behaves the same as the parser would on a fresh upload.
- **Snack pack highlighting**: this keyword was already correctly present
  in both `HIGHLIGHT_PATTERN` (Python) and `HIGHLIGHT_RE` (JS) — confirmed
  it matches "6x Snack Pack" correctly in isolation. The visible bug was
  entirely caused by the same corruption above, not a missing keyword.
- Pickup rows preserve whatever literal text the source contains (e.g.
  "N/A") rather than blanking it — Stage Time remains the one exception,
  since it's a value this app computes/derives and is never present in the
  raw source at all, so it's correctly left blank for pickups (matching
  your explicit "NOT calculate Stage Time" instruction from earlier).

### Files changed
`api/pipeline.py`, `api/generate.py` (docstring only),
`components/ReviewStep.js`, `lib/deliveryLogRules.js`, `README.md`.

### New files
None.

### Unchanged
`api/parse.py`, `api/requirements.txt`, `components/Chrome.js`,
`components/GenerateStep.js`, `components/UploadStep.js`, `pages/index.js`,
`styles/theme.js`, `package.json`, `vercel.json`.

### Testing actually executed for this pass

- **Re-ran the parser against `blank.pdf`** (the original, extensively
  validated source) — confirmed byte-for-byte the same 29 correct data rows
  as before the regression, with no corruption anywhere.
- **Unit-tested the exact real-world pickup row** (Ruthie Young, $5760.00,
  "Wholesale Pick Up Order", Group="Pickup", Departure="N/A") through the
  actual column-boundary lookup — every field lands in the correct column,
  and `_classify_row()` correctly returns `'pickup'`.
- **Ran the full parse → classify → stage-time pipeline** on that data and
  confirmed the final record has `type: 'pickup'`, `group: 'Pickup'`,
  `departure: 'N/A'` (both preserved literally), and `stage: ''` (correctly
  never computed).
- **Posted through the real `/api/generate` route** with that exact data —
  200 OK, no validation error — then rendered the resulting PDF to an image
  and visually confirmed it matches your Image 1 (same field layout, same
  literal "Pickup"/"N/A" values, Stage Time intentionally blank).
- **Full interactive test** (Node + jsdom executing the real component
  files): uploaded mocked data replicating both the Margaret O'Shea
  Snack-Pack row and the Ruthie Young pickup row, confirmed "6x Snack Pack"
  renders with an actual highlight span, confirmed the pickup row renders
  with no stray "Nash" contamination and shows the pickup tag, clicked
  straight through to Generate, and inspected the real JSON payload sent to
  `/api/generate` — confirmed `group: "Pickup"` and `departure: "N/A"` are
  preserved exactly, not replaced with blanks or fake values.
- **Tested live reclassification**: edited a normal delivery row's Delivery
  Group cell to "Pickup" in the actual rendered UI and confirmed the pickup
  tag appears immediately, without needing to re-upload.
- `npm run build` — compiles clean, no errors or warnings.

## What's new in this pass (correct Pick Ups fix — tested against your real PDF)

**This time I had your actual raw source PDF** (the one with the real "Pick
Ups" heading), not a guess or a screenshot. Every claim below was verified
by actually running the parser against that exact file.

### What was wrong in v9

v9's pickup detection assumed pickups are identified by their own field
values (literal "Pickup" in Delivery Group, literal "N/A" in Departure
Time). Your real PDF doesn't do that — it has a literal standalone **"Pick
Ups"** heading on its own line, followed by a pickup-specific header row,
followed by the pickup orders, with Delivery Group and Departure Time
genuinely *absent* (not filled with sentinel text). Since v9 didn't
recognize that heading, it fell through to the wrapped-continuation-line
logic and appended "Pick Ups" onto the previous row's Contact Name field —
turning "Carolina Oliveira" into "Carolina Oliveira Pick Ups" — and left
82819 as a normal `'data'` row with blank Group/Departure, which Generate
then correctly (but wrongly, for this row) rejected as missing required
delivery fields.

### The fix

**No changes to column boundaries or the delivery parsing logic** — exactly
as instructed. The fix is entirely in how pickups get identified:

- `api/pipeline.py`: added `PICKUP_HEADING_RE` — matches a line whose full
  text is exactly "Pick Ups" (case-insensitive). When the parser encounters
  it, it now (a) does **not** treat it as a continuation line, (b) records it
  as a `{'type': 'pickup_section', 'label': 'Pick Ups'}` divider, and (c)
  sets an `in_pickups` flag that's checked every time a new order row
  starts. Every order row parsed after that point is created directly as
  `type: 'pickup'` instead of `'data'` — no post-hoc reclassification
  needed for this path.
- The pickup table's own header row ("Order No. Contact Name Company Pick
  up Address Order Total $ Internal ops notes Instructions") is already
  skipped by the existing `text.startswith('Order No.')` check — no new
  code needed there.
- The old value-based check (`_classify_row`: literal "Pickup" in Group, or
  literal "N/A" in Departure) is **kept as a fallback**, applied only to
  rows the heading-based path didn't already classify — covers a future
  export that might use that format instead, without being the primary
  mechanism for the format your real PDF actually uses.
- `components/ReviewStep.js`: restored the `pickup_section` divider type
  (with its "PICK UPS" badge) that v9 had removed. Drag-and-drop stays as
  pure reordering — it does not attempt to reclassify rows based on where
  they're dropped; classification is driven by the heading (on parse) or by
  editing Group/Departure directly (in the review screen, unchanged from
  v9's live-reclassification feature).

### Files changed
`api/pipeline.py`, `components/ReviewStep.js`, `README.md`.

### New files
None.

### Unchanged
`api/parse.py`, `api/generate.py`, `api/requirements.txt`,
`components/Chrome.js`, `components/GenerateStep.js`,
`components/UploadStep.js`, `lib/deliveryLogRules.js`, `pages/index.js`,
`styles/theme.js`, `package.json`, `vercel.json`.

### Testing actually executed — against your real PDF, with your exact assertions

Every one of the assertions you specified was run directly against
`api/pipeline.py`'s `parse_delivery_log()` on your actual uploaded file:

| Assertion | Result |
|---|---|
| Order 83392 contact == `"Carolina Oliveira"` exactly | **PASS** |
| "Pick Ups" recognized as a section | **PASS** (1 `pickup_section` record) |
| 82819 has `type: 'pickup'` | **PASS** |
| 82819 contact == `"Ruthie Young"` | **PASS** |
| 82819 address == `"1970 Innes Avenue San Francisco"` | **PASS** |
| 82819 total == `"$5760.00"` | **PASS** |
| 82819 notes == `"Wholesale Pick Up Order"` | **PASS** |
| 82819 group == `""` (blank) | **PASS** |
| 82819 departure == `""` (blank) | **PASS** |
| 83352, 83267, 83249, 83312 unchanged, `type: 'data'` | **PASS** (all four) |

Beyond that checklist:

- **Posted the real parsed data through the actual `/api/generate` route**
  — 200 OK, no validation error — then rendered the resulting PDF to an
  image and visually confirmed page 4: "Carolina Oliveira" is clean, "Pick
  Ups" renders as its own divider row, and 82819/Ruthie Young shows with
  Group/Departure/Stage genuinely blank.
- **Full interactive test** (Node + jsdom executing the real component
  files) using the actual parsed output of your real PDF as the mocked
  `/api/parse` response: confirmed on Step 2 that "Carolina Oliveira"
  appears with no "Pick Ups" appended, the "PICK UPS" badge renders, Ruthie
  Young's row shows the pickup tag, clicking straight through to Generate
  is **not** blocked, and the actual JSON payload sent to `/api/generate`
  has `type: "pickup"` with genuinely blank (not faked) group/departure for
  82819, while 83352 is byte-for-byte unchanged.
- `npm run build` — compiles clean, no errors or warnings.

One thing noticed but **not fixed** (out of scope for this targeted fix,
per your instructions): order 83392's note reads "9x items, bag, 4x HOT
FOOD, 4x roasted salsa" — the "9x" (vs. the usual "9") slightly confuses
the highlight-exclusion pattern, so "9x items," gets highlighted along with
the rest instead of staying plain. Everything else about that row parses
correctly. Happy to fix this separately if you'd like.

## SHA-256 checksums (verify against your GitHub repo)

```
0c648c7994d8690e2acb32560fa61bd7248f7084522e69af84ea31949b2ff828  api/generate.py
dc3219a8ac2df7adcedaae510b30e3792fd221333367c124bf4ba608ed9d4d7b  api/parse.py
13d4a3f2ce8a6c2dba6b455459fff99b1b8ed7a80efef948117baf4bfdeb6b5f  api/pipeline.py
218e9d89a6de152c6f1b17c4ff9c752e7935ac8a1dd83c14be922ce36985110d  components/Chrome.js
5971c490ef53aadcd3d3dcd1550a0a574cd47cbf26299394d02212a577d89f85  components/GenerateStep.js
1315f83aaaae16270b72cb96b5eb9170c51d7fefb804dac512b277a896166e77  components/ReviewStep.js
d1c2b47f4f1c348ea6c16e84f76b42bc4690115c59a0a1c63248e58114cb1d5a  components/UploadStep.js
55cf707523614fc98c66a54696d3800d199092d49d5481772d846842bce0a36f  lib/deliveryLogRules.js
45429ffca0556a17d9c321cba493b9d330654eb0465bfc112f98f1c05ffe4d4a  pages/index.js
64008799af2d1310332f1a22cadc407aa97f361104fb6360035c424ca98ff777  styles/theme.js
```

## Notes for future tweaks

- **Highlight keywords** — `HIGHLIGHT_PATTERN` in `api/pipeline.py` (keep
  `lib/deliveryLogRules.js`'s `HIGHLIGHT_RE` in sync).
- **Highlight override resolution** — `should_highlight()` in
  `api/pipeline.py` / `resolveHighlight()` in `lib/deliveryLogRules.js`.
- **Stage Time offset/rounding** — `compute_stage_time()` /
  `computeStageTime()`.
- **Column-header label recognition** — `LABEL_PHRASES` in
  `api/pipeline.py`. If a future export wraps a different label across two
  lines, add a single-word fallback here the same way `departure`/`group`/
  `total`/`notes` were added.
- **Pick Ups detection** — `PICKUP_SECTION_RE` in `api/pipeline.py`.
- **Drag-and-drop reclassification rule** — `sectionTypeAtIndex()` in
  `components/ReviewStep.js`.
- **Required fields per row type** — `REQUIRED_FIELDS_BY_TYPE` in
  `api/generate.py`.
- **Review table column widths** — `FIELD_COLUMNS` in
  `components/ReviewStep.js` (PDF's own widths are separate: `COL_WIDTHS` in
  `api/pipeline.py`).
- **Delivery date format / extraction pattern** — `lib/deliveryLogRules.js`.
- **Visual theme** — `styles/theme.js`.
- **Bi-Rite logo** — still a text-based placeholder in `components/Chrome.js`
  (`logoBox`/`logoText`). Swap in the real logo via
  `<img src="/bi-rite-logo.png" />` + a new `public/` folder.
