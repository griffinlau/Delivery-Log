# Delivery Log Formatter

A 3-step Bi-Rite Operations tool: **Upload → Review & Edit → Generate**.

Takes the raw "OPS - Print Delivery Log" PDF export, lets you review and fix
anything before printing — including manually overriding the highlight on
any note — then produces the finished PDF:

- Column headers repeated at the top of every page
- A **Stage Time** column (Departure Time minus 30 minutes, rounded to the
  nearest 5 minutes) — editable, with manual overrides respected
- Internal ops notes highlighted yellow across the *entire actionable portion*
  after "N items, bag," whenever a trigger word is present — **and now
  manually overridable per row** (Auto / On / Off)
- A **Delivery Date** — auto-detected from the uploaded sheet where possible,
  defaulting to tomorrow otherwise, always editable, used consistently
  everywhere a date is shown (header, Review screen, Generate screen, PDF)
- Deterministic PDF parsing — no AI/LLM calls, ever
- Everything else preserved exactly as parsed, unless you edit it

## IMPORTANT — root cause of the "changes aren't showing up" issue

`vercel.json` previously pinned `"runtime": "@vercel/python@4.3.0"`, which
you reported broke your Vercel deployment. **That is almost certainly why
earlier rounds of fixes didn't appear to take effect** — if that build was
failing, Vercel would have kept serving the last *successful* deployment
(an old build), no matter what code was pushed afterward. This version
restores the safe, working config:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json"
}
```

This lets Vercel auto-detect the Python functions in `api/` without pinning
a runtime version. **Do not reintroduce a runtime pin** unless you've
confirmed the specific version string against Vercel's current docs first.

## Project layout

```
delivery-log-tool/
├── api/
│   ├── parse.py            # POST /api/parse    — PDF in, structured JSON out
│   ├── generate.py         # POST /api/generate  — edited JSON in, PDF out
│   ├── pipeline.py          # parsing / Stage Time / highlight (incl. overrides) / PDF-build
│   └── requirements.txt     # flask, pdfplumber, reportlab
├── components/
│   ├── Chrome.js             # header, step indicator, footer
│   ├── UploadStep.js         # Step 1 — Delivery Date field + centered upload card
│   ├── ReviewStep.js         # Step 2 — editable table + highlight override UI
│   └── GenerateStep.js       # Step 3 — summary, download, print
├── lib/
│   └── deliveryLogRules.js   # JS mirror of highlight/Stage-Time rules + date helpers
├── styles/
│   └── theme.js              # shared Bi-Rite Operations look (dark navy/teal)
├── pages/
│   └── index.js              # wires the 3 steps + delivery-date state together
├── package.json
└── vercel.json               # safe, auto-detected Python runtime (see above)
```

## What's new in this pass (fixed the Step 2 navigation bar)

**The problem:** `position: sticky` was used for the Back/Reset/Continue bar.
Sticky positioning only pins an element while scrolling *within its own
containing block* — it's a much more fragile mechanism than it looks, and in
practice it was only appearing once you scrolled to the very bottom, exactly
as reported.

**The fix:** switched to `position: fixed`, which pins to the viewport
unconditionally, with no containing-block subtlety to get wrong:
- The bar is now `position: fixed; bottom: 0`, centered via
  `left: 50%; transform: translateX(-50%)`, with
  `width: min(1700px, 96vw)` — the exact same width token the table itself
  uses — so it always lines up with the table's edges instead of spanning
  the full browser width.
- A new 84px `.bottom-spacer` sits in normal document flow right after the
  table card, so scrolling to the true end of the log always clears the
  fixed bar before you reach the footer — nothing can end up hidden behind
  it.
- Visually it's a subtle floating dock: same card background/border as the
  rest of the theme, rounded top corners, a soft upward shadow for
  separation, no heavy weight or color changes.
- Confirmed this compiled into the actual production bundle (not just
  source): `position:fixed;left:50%;bottom:0;...transform:translatex(-50%);
  width:min(1700px,96vw)` is present in the built JS, along with the 84px
  spacer rule.
- Re-ran the interactive jsdom test suite against the real component: after
  upload, `.action-bar-wrap` and `.bottom-spacer` are both present in the DOM
  and all three buttons (← Back, Reset Changes, Continue to Generate →)
  render inside the fixed bar as expected.

Files changed this pass: `components/ReviewStep.js` only.

## What's new (previous pass — highlight overrides, Vercel fix)

### 1. Manual highlight override (Auto / On / Off) per order

- Each Internal Ops Notes cell now has a small 🖍 icon that appears on hover
  (top-right of the cell). Clicking it opens a compact 3-option menu — **Auto
  / On / Off** — with the current mode checked.
- **Auto** (default): existing keyword logic decides, exactly as before.
- **On**: forces the actionable portion (after "N items, bag,") to yellow,
  even with no trigger keyword.
- **Off**: suppresses the yellow highlight even if a trigger keyword is
  present.
- Overrides count as a manual change, work with **Reset Changes** (which
  restores every row's mode back to `auto`), persist across Steps 2 → 3, and
  are sent to `/api/generate` as a `highlight_mode` field per row — the PDF
  and the web preview share the exact same resolution logic
  (`should_highlight()` in Python, `resolveHighlight()` in JS), so they can
  never disagree.
- **Edge case, by design**: forcing "On" on a note with nothing after "N
  items, bag" (e.g. plain "8 items, bag") highlights nothing, because there's
  no actionable text to highlight — this matches the PDF's behavior exactly
  and was verified directly (see Testing below).

### 2. Notes editing clarity

- While a note is being edited, a small "Highlight: Auto/On/Off" badge shows
  above the input, so the current mode is never invisible mid-edit.
- After saving, AUTO-mode notes immediately re-evaluate against the new text;
  manual On/Off overrides are preserved through the edit.
- Notes still render **exactly once** — no duplicate white-then-yellow lines.

### 3. Bottom action bar no longer covers the last rows

- Added `padding-bottom: 64px` to the last row of the table specifically, so
  there's always enough scroll room for the true last row to clear the sticky
  action bar before you reach the end of the table. Verified this rule
  actually compiled into the production bundle (see Testing below).

### 4. Parser sanity re-check

- Re-ran the deterministic parser against the real sample PDF and hand-
  checked known tricky rows (multi-line company names, missing company
  fields, 3-line-wrapped contacts) — all fields land in the correct column
  with no cross-contamination. No parsing code was changed this pass (none
  was needed) — see Testing below for the exact rows checked.

### 5. Vercel config fixed

- See the note at the top of this README.

### Files changed
`api/pipeline.py`, `components/ReviewStep.js`, `components/GenerateStep.js`,
`lib/deliveryLogRules.js`, `vercel.json`, `README.md`.

### New files
None.

### Unchanged
`api/parse.py`, `api/generate.py`, `api/requirements.txt`,
`components/Chrome.js`, `components/UploadStep.js`, `pages/index.js`,
`styles/theme.js`, `package.json`.

## Testing actually executed for this pass

Everything below was run against the real, unmodified source files in this
zip — not inferred from reading the code.

**Backend (Python, via Flask's test client hitting the real routes):**
- `should_highlight()` / `render_notes_markup()` unit-tested directly:
  auto+keyword → True, auto+no-keyword → False, forced-on+no-keyword → True
  (but renders no visible highlight since there's nothing after "items, bag"
  — confirmed this is correct, not a bug), forced-off+keyword → False.
- Posted a real multipart request to `/api/generate` with one row forced ON
  (no keyword) and one row forced OFF (has "hot food") and rendered the
  resulting PDF to an image — confirmed row 1 highlights "special request"
  (no keyword needed) and row 2 stays fully plain despite containing "hot
  food".
- Re-ran the deterministic parser against the sample PDF and spot-checked
  4 known tricky rows (wrapped company name, missing company, 3-line wrap) —
  all fields correctly separated, 29 data rows total, no stray fragments.

**Frontend (Node + jsdom, executing the real component files — not just
reading them):**
- Uploaded a mocked PDF response and confirmed the app lands on Step 2 with
  the correct Delivery Date.
- Clicked the 🖍 icon on a no-keyword row, selected "On" — confirmed exactly
  one new highlight span appears with the resolved text, and the manual-
  change counter shows "1 manual change".
- Clicked the 🖍 icon on a has-keyword row, selected "Off" — confirmed its
  highlight span disappears and the counter shows "2 manual changes".
- Clicked **Reset Changes** — confirmed the counter returns to "No manual
  changes" and highlighting reverts to exactly the original auto-detected
  state.
- Re-applied an override, clicked **Continue to Generate**, and inspected the
  actual JSON payload sent to `/api/generate` — confirmed `highlight_mode:
  "on"` was included for that row.
- Edited a Departure Time and confirmed Stage Time auto-recalculated
  correctly; then manually edited Stage Time directly and confirmed a
  *subsequent* Departure Time change did **not** overwrite the manual Stage
  Time (matches the existing override-lock behavior).
- Edited a Contact Name, then walked through to the generate payload and
  confirmed the corrected name, the edited Departure Time, and the manually-
  overridden Stage Time all appear in what gets sent to `/api/generate` —
  then actually generated that exact PDF and visually confirmed all three
  edits render correctly in the output (see the generate step in the
  conversation for the rendered page).
- Grepped the actual compiled production JS bundle (`npm run build` output)
  and confirmed the `padding-bottom:64px` last-row rule is present in the
  shipped CSS, not just the source.

**Build:**
- `npm run build` — compiles clean, no type/lint errors or warnings.

**Not done:** a real-browser pixel screenshot (still no browser binary
available in this environment). Everything above was verified through actual
code execution (Python test client + jsdom-rendered React), which is a much
stronger guarantee than source review, but a final visual pass in an actual
browser after deploying is still worth doing.

## SHA-256 checksums (verify against your GitHub repo)

```
ac6d44ae2c152057d14575d31a20e8f3fb95b5fb20c3fb439d90d8798ec1dea5  api/generate.py
83eaac5f10ce3f98da884d964188efbf1a0f4cde04acb67f86bb29ffdc197d4d  api/parse.py
249912714108f0dd0293edb430f4e2dce216839715dde235c5507e2c08818199  api/pipeline.py
218e9d89a6de152c6f1b17c4ff9c752e7935ac8a1dd83c14be922ce36985110d  components/Chrome.js
a8ab365530ae098a7b005a334109f435a4e5161e23e0180adc569d3f87ddf5c8  components/GenerateStep.js
ef32d7420645f8d735e3abf3b025370c241ac7a5dce520668e410667438aa3a9  components/ReviewStep.js
d1c2b47f4f1c348ea6c16e84f76b42bc4690115c59a0a1c63248e58114cb1d5a  components/UploadStep.js
70c11bb5e170a1861f90a1ada4e21ddb72f2ddfcb878668b00417a8c87f57ba6  lib/deliveryLogRules.js
45429ffca0556a17d9c321cba493b9d330654eb0465bfc112f98f1c05ffe4d4a  pages/index.js
64008799af2d1310332f1a22cadc407aa97f361104fb6360035c424ca98ff777  styles/theme.js
```

## Deploy

1. Delete the existing files in your GitHub repo (or delete/recreate it) and
   upload this zip's contents fresh, all at once — don't merge individual
   files across versions, to avoid stale files lingering.
2. Import/redeploy in Vercel. Since `vercel.json` no longer pins a runtime,
   this should build successfully this time. If you're redeploying an
   existing project, use Deployments → "..." → Redeploy and uncheck "Use
   existing Build Cache" to be safe.
3. Hard-refresh the browser tab (Cmd/Ctrl+Shift+R) before judging the result.

## Notes for future tweaks

- **Highlight keywords** — `HIGHLIGHT_PATTERN` in `api/pipeline.py` (keep
  `lib/deliveryLogRules.js`'s `HIGHLIGHT_RE` in sync).
- **Highlight override resolution** — `should_highlight()` in
  `api/pipeline.py` / `resolveHighlight()` in `lib/deliveryLogRules.js`.
- **Stage Time offset/rounding** — `compute_stage_time()` /
  `computeStageTime()`.
- **Column widths in the review table** — `FIELD_COLUMNS` in
  `components/ReviewStep.js`.
- **PDF column widths / styling** — `COL_WIDTHS`, `HEADERS`, `TableStyle` in
  `build_pdf()` in `api/pipeline.py`.
- **Delivery date format / extraction pattern** — `lib/deliveryLogRules.js`.
- **Visual theme** — `styles/theme.js`.
- **Bi-Rite logo** — still a text-based placeholder in `components/Chrome.js`
  (`logoBox`/`logoText`). Swap in the real logo via
  `<img src="/bi-rite-logo.png" />` + a new `public/` folder.
