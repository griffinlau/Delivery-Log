// Mirrors api/pipeline.py exactly — keep these two in sync if the rules ever change.

const HIGHLIGHT_RE = /\b(?:hot food|boxed meals|salsa|coffee|hh|alcohol|bevs?)\b/gi;
const EXCLUDE_RE = /\d+\s*items?,?\s*|bag,?\s*/gi;

export function isHighlighted(notes) {
  HIGHLIGHT_RE.lastIndex = 0;
  return HIGHLIGHT_RE.test(notes || '');
}

// Resolves the effective highlight decision: an explicit 'on'/'off' override
// always wins; 'auto' (or missing) falls back to keyword detection. Mirrors
// api/pipeline.py's should_highlight() exactly.
export function resolveHighlight(notes, mode) {
  const m = (mode || 'auto').trim().toLowerCase();
  if (m === 'on') return true;
  if (m === 'off') return false;
  return isHighlighted(notes);
}

// Returns an array of { text, highlighted } segments for rendering.
// `mode` is the row's highlight_mode ('auto' | 'on' | 'off').
export function splitHighlightSegments(notes, mode) {
  const text = notes || '';
  if (!resolveHighlight(text, mode)) return [{ text, highlighted: false }];

  const segments = [];
  let pos = 0;
  EXCLUDE_RE.lastIndex = 0;
  let m;
  while ((m = EXCLUDE_RE.exec(text)) !== null) {
    if (m.index > pos) {
      segments.push({ text: text.slice(pos, m.index), highlighted: true });
    }
    segments.push({ text: m[0], highlighted: false });
    pos = m.index + m[0].length;
  }
  if (pos < text.length) {
    segments.push({ text: text.slice(pos), highlighted: true });
  }
  return segments;
}

// Departure "06:41 am" -> Stage "06:10 am" (30 min earlier, rounded to nearest 5)
export function computeStageTime(departureStr) {
  if (!departureStr) return '';
  const m = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(departureStr.trim());
  if (!m) return '';
  let [, hh, mm, ap] = m;
  let hours = parseInt(hh, 10) % 12;
  if (ap.toLowerCase() === 'pm') hours += 12;
  const minutes = parseInt(mm, 10);

  const total = hours * 60 + minutes - 30;
  const wrapped = ((total % 1440) + 1440) % 1440;
  const rounded = Math.round(wrapped / 5) * 5;
  const finalTotal = ((rounded % 1440) + 1440) % 1440;

  let outHours = Math.floor(finalTotal / 60);
  const outMinutes = finalTotal % 60;
  const outAp = outHours >= 12 ? 'pm' : 'am';
  let displayHours = outHours % 12;
  if (displayHours === 0) displayHours = 12;

  const hhStr = String(displayHours).padStart(2, '0');
  const mmStr = String(outMinutes).padStart(2, '0');
  return `${hhStr}:${mmStr} ${outAp}`;
}

// ---------------------------------------------------------------------------
// Delivery date handling
// ---------------------------------------------------------------------------

const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

// All date values in this app are plain 'YYYY-MM-DD' strings (matches
// <input type="date">) and are always constructed/parsed via the local-time
// component constructor, never `new Date(isoString)`, to avoid UTC off-by-one
// shifts.

export function toISODateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseISODateLocal(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function tomorrowISODate() {
  const now = new Date();
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return toISODateLocal(t);
}

// Extracts a date from a title like "OPS - Print Delivery Log - Tue 11 Aug 2026".
// Returns an ISO 'YYYY-MM-DD' string, or null if no reliable date is found.
export function extractDateFromTitle(title) {
  if (!title) return null;
  const m = /(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\s*$/.exec(title.trim());
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const monthIdx = MONTHS[m[2].toLowerCase()];
  const year = parseInt(m[3], 10);
  if (monthIdx === undefined || day < 1 || day > 31) return null;
  const d = new Date(year, monthIdx, day);
  if (d.getMonth() !== monthIdx || d.getDate() !== day) return null; // guards invalid dates like Feb 30
  return toISODateLocal(d);
}

// "Tuesday, August 11, 2026" — used in the header and Step 2/3 confirmation line.
export function formatLongDate(iso) {
  if (!iso) return '';
  return parseISODateLocal(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

// "Tue 11 Aug 2026" — matches the original PDF title's date suffix format,
// used to rebuild the title sent to /api/generate so the PDF reflects the
// confirmed delivery date rather than whatever was in the raw upload.
export function formatTitleDateSuffix(iso) {
  if (!iso) return '';
  const d = parseISODateLocal(iso);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return `${weekday} ${d.getDate()} ${month} ${d.getFullYear()}`;
}
