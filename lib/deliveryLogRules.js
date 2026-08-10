// Mirrors api/pipeline.py exactly — keep these two in sync if the rules ever change.

const HIGHLIGHT_RE = /\b(?:hot food|boxed meals|salsa|coffee|hh|alcohol|bevs?)\b/gi;
const EXCLUDE_RE = /\d+\s*items?,?\s*|bag,?\s*/gi;

export function isHighlighted(notes) {
  HIGHLIGHT_RE.lastIndex = 0;
  return HIGHLIGHT_RE.test(notes || '');
}

// Returns an array of { text, highlighted } segments for rendering.
export function splitHighlightSegments(notes) {
  const text = notes || '';
  if (!isHighlighted(text)) return [{ text, highlighted: false }];

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
