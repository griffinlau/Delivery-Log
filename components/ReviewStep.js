import { theme, s } from '../styles/theme';
import { splitHighlightSegments, computeStageTime } from '../lib/deliveryLogRules';

const FIELD_COLUMNS = [
  { key: 'order_no', label: 'Order No.', width: 90, editable: false },
  { key: 'contact', label: 'Contact Name', width: 160, editable: true },
  { key: 'company', label: 'Company', width: 140, editable: true },
  { key: 'address', label: 'Delivery Address', width: 220, editable: true },
  { key: 'total', label: 'Order Total $', width: 100, editable: true },
  { key: 'notes', label: 'Internal Ops Notes', width: 260, editable: true },
  { key: 'group', label: 'Delivery Group', width: 100, editable: true },
  { key: 'departure', label: 'Departure Time', width: 110, editable: true },
  { key: 'stage', label: 'Stage Time', width: 110, editable: true },
];

function isRowEdited(row, originalRow) {
  if (!originalRow) return false;
  return FIELD_COLUMNS.some((c) => (row[c.key] || '') !== (originalRow[c.key] || ''));
}

function cellInputStyle(hasFocusRing) {
  return {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid transparent',
    color: theme.textPrimary,
    fontSize: 12.5,
    fontFamily: theme.fontFamily,
    padding: '2px 2px',
    outline: 'none',
  };
}

export function ReviewStep({ records, originalRecords, onChange, onBack, onContinue, onReset }) {
  const dataRows = records.filter((r) => r.type === 'data');
  const editedCount = records.reduce((sum, r, i) => {
    if (r.type !== 'data') return sum;
    return sum + (isRowEdited(r, originalRecords[i]) ? 1 : 0);
  }, 0);

  function updateField(idx, key, value) {
    const next = records.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [key]: value };
      if (key === 'departure') {
        if (!updated.stage_manual) {
          updated.stage = computeStageTime(value);
        }
      }
      if (key === 'stage') {
        updated.stage_manual = true;
      }
      return updated;
    });
    onChange(next);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={s.sectionLabel}>STEP 2 — REVIEW &amp; EDIT</div>
        <div style={{ fontSize: 12.5, color: editedCount > 0 ? theme.accent : theme.textMuted }}>
          {editedCount > 0 ? `${editedCount} manual change${editedCount === 1 ? '' : 's'}` : 'No manual changes'}
        </div>
      </div>

      <div
        style={{
          ...s.card,
          padding: 0,
          overflow: 'hidden',
        }}
      >
        <div style={{ maxHeight: 560, overflow: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1200 }}>
            <thead>
              <tr>
                {FIELD_COLUMNS.map((c, ci) => (
                  <th
                    key={c.key}
                    style={{
                      position: 'sticky',
                      top: 0,
                      left: ci === 0 ? 0 : undefined,
                      zIndex: ci === 0 ? 3 : 2,
                      background: '#0f2a31',
                      color: theme.textSecondary,
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      textAlign: 'left',
                      padding: '10px 10px',
                      borderBottom: `1px solid ${theme.cardBorder}`,
                      minWidth: c.width,
                    }}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((row, idx) => {
                if (row.type === 'section') {
                  return (
                    <tr key={`section-${idx}`}>
                      <td
                        colSpan={FIELD_COLUMNS.length}
                        style={{
                          background: theme.sectionRowBg,
                          color: theme.textPrimary,
                          fontWeight: 700,
                          fontSize: 12.5,
                          padding: '8px 10px',
                          borderTop: `1px solid ${theme.cardBorder}`,
                          borderBottom: `1px solid ${theme.cardBorder}`,
                        }}
                      >
                        {row.label}
                      </td>
                    </tr>
                  );
                }

                const edited = isRowEdited(row, originalRecords[idx]);
                const segments = splitHighlightSegments(row.notes);

                return (
                  <tr key={`row-${idx}`}>
                    {FIELD_COLUMNS.map((c, ci) => {
                      const isFirst = ci === 0;
                      const cellBase = {
                        padding: '8px 10px',
                        borderBottom: `1px solid ${theme.cardBorder}`,
                        verticalAlign: 'top',
                        background: theme.cardBg,
                      };
                      if (isFirst) {
                        return (
                          <td
                            key={c.key}
                            style={{
                              ...cellBase,
                              position: 'sticky',
                              left: 0,
                              zIndex: 1,
                              background: '#0c2129',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {edited && (
                                <span
                                  title="Edited"
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    background: theme.editedDot,
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                              <span style={{ fontSize: 12.5, color: theme.textPrimary }}>{row.order_no}</span>
                            </div>
                          </td>
                        );
                      }
                      if (c.key === 'notes') {
                        return (
                          <td key={c.key} style={cellBase}>
                            <input
                              value={row.notes || ''}
                              onChange={(e) => updateField(idx, 'notes', e.target.value)}
                              style={cellInputStyle()}
                            />
                            <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.5 }}>
                              {segments.map((seg, si) =>
                                seg.highlighted ? (
                                  <span
                                    key={si}
                                    style={{ background: theme.highlightBg, color: theme.highlightText, padding: '0 1px' }}
                                  >
                                    {seg.text}
                                  </span>
                                ) : (
                                  <span key={si} style={{ color: theme.textMuted }}>{seg.text}</span>
                                )
                              )}
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td key={c.key} style={cellBase}>
                          <input
                            value={row[c.key] || ''}
                            disabled={!c.editable}
                            onChange={(e) => updateField(idx, c.key, e.target.value)}
                            style={{
                              ...cellInputStyle(),
                              color: c.editable ? theme.textPrimary : theme.textSecondary,
                              cursor: c.editable ? 'text' : 'default',
                            }}
                            onFocus={(e) => { e.target.style.borderBottom = `1px solid ${theme.accent}`; }}
                            onBlur={(e) => { e.target.style.borderBottom = '1px solid transparent'; }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }}>
        <button style={s.secondaryButton} onClick={onBack}>← Back</button>
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={s.secondaryButton} onClick={onReset} disabled={editedCount === 0}>
            Reset Changes
          </button>
          <button style={s.primaryButton} onClick={onContinue}>
            Continue to Generate →
          </button>
        </div>
      </div>
    </div>
  );
}

export { FIELD_COLUMNS, isRowEdited };
