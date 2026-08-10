import { useEffect, useRef, useState } from 'react';
import { theme, s } from '../styles/theme';
import { splitHighlightSegments, computeStageTime, formatLongDate } from '../lib/deliveryLogRules';

const FIELD_COLUMNS = [
  { key: 'order_no', label: 'Order No.', width: 76, editable: false, align: 'left' },
  { key: 'contact', label: 'Contact Name', width: 150, editable: true, align: 'left' },
  { key: 'company', label: 'Company', width: 130, editable: true, align: 'left' },
  { key: 'address', label: 'Delivery Address', width: 230, editable: true, align: 'left' },
  { key: 'total', label: 'Order Total $', width: 92, editable: true, align: 'right' },
  { key: 'notes', label: 'Internal Ops Notes', width: 300, editable: true, align: 'left' },
  { key: 'group', label: 'Delivery Group', width: 92, editable: true, align: 'left' },
  { key: 'departure', label: 'Departure Time', width: 100, editable: true, align: 'left' },
  { key: 'stage', label: 'Stage Time', width: 100, editable: true, align: 'left' },
];

const HIGHLIGHT_MODES = [
  { value: 'auto', label: 'Auto' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
];

function isRowEdited(row, originalRow) {
  if (!originalRow) return false;
  const fieldsChanged = FIELD_COLUMNS.some((c) => (row[c.key] || '') !== (originalRow[c.key] || ''));
  const modeChanged = (row.highlight_mode || 'auto') !== (originalRow.highlight_mode || 'auto');
  return fieldsChanged || modeChanged;
}

export function ReviewStep({ records, originalRecords, deliveryDate, onChange, onBack, onContinue, onReset }) {
  const [editing, setEditing] = useState(null); // { idx, key } | null
  const [draftValue, setDraftValue] = useState('');
  const [highlightMenuIdx, setHighlightMenuIdx] = useState(null); // row idx with the mode menu open, or null
  const menuRef = useRef(null);

  const dataRows = records.filter((r) => r.type === 'data');
  const editedCount = records.reduce((sum, r, i) => {
    if (r.type !== 'data') return sum;
    return sum + (isRowEdited(r, originalRecords[i]) ? 1 : 0);
  }, 0);

  useEffect(() => {
    if (highlightMenuIdx === null) return;
    function handleOutsideClick(e) {
      if (!e.target.closest('.highlight-menu-wrap')) {
        setHighlightMenuIdx(null);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [highlightMenuIdx]);

  function updateField(idx, key, value) {
    const next = records.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [key]: value };
      if (key === 'departure' && !updated.stage_manual) {
        updated.stage = computeStageTime(value);
      }
      if (key === 'stage') {
        updated.stage_manual = true;
      }
      return updated;
    });
    onChange(next);
  }

  function setHighlightMode(idx, mode) {
    const next = records.map((r, i) => (i === idx ? { ...r, highlight_mode: mode } : r));
    onChange(next);
    setHighlightMenuIdx(null);
  }

  function startEdit(idx, key, currentValue) {
    setHighlightMenuIdx(null);
    setEditing({ idx, key });
    setDraftValue(currentValue || '');
  }

  function commit() {
    if (!editing) return;
    updateField(editing.idx, editing.key, draftValue);
    setEditing(null);
  }

  function cancel() {
    setEditing(null);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 6 }}>
        <div>
          <div style={s.sectionLabel}>STEP 2 — REVIEW &amp; EDIT</div>
          <div style={{ fontSize: 13, color: theme.accent, fontWeight: 600, marginBottom: 2 }}>
            Delivery Date: {formatLongDate(deliveryDate)}
          </div>
          <div style={{ fontSize: 12, color: theme.textMuted }}>
            Click any editable field to make a correction. Hover a note for highlight options.
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: editedCount > 0 ? theme.accent : theme.textMuted, fontWeight: 600 }}>
          {editedCount > 0 ? `${editedCount} manual change${editedCount === 1 ? '' : 's'}` : 'No manual changes'}
        </div>
      </div>

      <div style={{ ...s.card, padding: 0, marginTop: 14, overflow: 'hidden' }}>
        <div className="table-scroll">
          <table className="dlf-table">
            <colgroup>
              {FIELD_COLUMNS.map((c) => (
                <col key={c.key} style={{ width: c.width }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {FIELD_COLUMNS.map((c, ci) => (
                  <th
                    key={c.key}
                    className={ci === 0 ? 'sticky-col' : ''}
                    style={{ textAlign: c.align }}
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
                      <td colSpan={FIELD_COLUMNS.length} className="section-row">
                        {row.label}
                      </td>
                    </tr>
                  );
                }

                const edited = isRowEdited(row, originalRecords[idx]);
                const mode = row.highlight_mode || 'auto';
                const segments = splitHighlightSegments(row.notes, mode);
                const menuOpen = highlightMenuIdx === idx;

                return (
                  <tr key={`row-${idx}`} className="data-row">
                    {FIELD_COLUMNS.map((c, ci) => {
                      const isEditingThis = editing && editing.idx === idx && editing.key === c.key;
                      const isFirst = ci === 0;

                      if (isFirst) {
                        return (
                          <td key={c.key} className="sticky-col">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {edited && <span className="edited-dot" title="Edited" />}
                              <span>{row.order_no}</span>
                            </div>
                          </td>
                        );
                      }

                      if (c.key === 'notes' && isEditingThis) {
                        return (
                          <td key={c.key} className="editing-cell">
                            <div className={`mode-badge mode-${mode}`}>
                              Highlight: {HIGHLIGHT_MODES.find((m) => m.value === mode)?.label}
                            </div>
                            <input
                              autoFocus
                              value={draftValue}
                              onChange={(e) => setDraftValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); commit(); }
                                else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
                              }}
                              onBlur={commit}
                            />
                          </td>
                        );
                      }

                      if (isEditingThis) {
                        return (
                          <td key={c.key} className="editing-cell">
                            <input
                              autoFocus
                              value={draftValue}
                              onChange={(e) => setDraftValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); commit(); }
                                else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
                              }}
                              onBlur={commit}
                              style={{ textAlign: c.align }}
                            />
                          </td>
                        );
                      }

                      if (c.key === 'notes') {
                        return (
                          <td key={c.key} className="editable-cell notes-cell">
                            <span
                              className="notes-render"
                              onClick={() => startEdit(idx, c.key, row.notes)}
                            >
                              {segments.map((seg, si) =>
                                seg.highlighted ? (
                                  <span key={si} className="notes-highlight">{seg.text}</span>
                                ) : (
                                  <span key={si}>{seg.text}</span>
                                )
                              )}
                              <span className="edit-icon">✎</span>
                            </span>

                            <div className="highlight-menu-wrap">
                              <button
                                type="button"
                                className={`highlight-icon-btn ${mode !== 'auto' ? 'active' : ''}`}
                                title={`Highlight: ${HIGHLIGHT_MODES.find((m) => m.value === mode)?.label}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setHighlightMenuIdx(menuOpen ? null : idx);
                                }}
                              >
                                🖍
                              </button>
                              {menuOpen && (
                                <div className="highlight-menu" onClick={(e) => e.stopPropagation()}>
                                  {HIGHLIGHT_MODES.map((m) => (
                                    <div
                                      key={m.value}
                                      className={`highlight-menu-item ${mode === m.value ? 'selected' : ''}`}
                                      onClick={() => setHighlightMode(idx, m.value)}
                                    >
                                      {mode === m.value ? '✓ ' : ''}{m.label}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td
                          key={c.key}
                          className={c.editable ? 'editable-cell' : ''}
                          style={{ textAlign: c.align }}
                          onClick={() => c.editable && startEdit(idx, c.key, row[c.key])}
                        >
                          {row[c.key]}
                          {c.editable && <span className="edit-icon">✎</span>}
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

      {/* Reserves scroll room so the fixed bar below never overlaps the
          last table row or the page footer. */}
      <div className="bottom-spacer" />

      <div className="action-bar-wrap">
        <div className="action-bar">
          <button style={s.secondaryButton} onClick={onBack}>← Back</button>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              style={editedCount === 0 ? { ...s.secondaryButton, opacity: 0.5, cursor: 'default' } : s.secondaryButton}
              onClick={onReset}
              disabled={editedCount === 0}
            >
              Reset Changes
            </button>
            <button style={s.primaryButton} onClick={onContinue}>
              Continue to Generate →
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .table-scroll {
          overflow-x: auto;
          overflow-y: visible;
        }
        .dlf-table {
          border-collapse: collapse;
          width: 100%;
          min-width: ${FIELD_COLUMNS.reduce((sum, c) => sum + c.width, 0)}px;
          table-layout: fixed;
          font-size: 13px;
        }
        .dlf-table thead th {
          position: sticky;
          top: 0;
          z-index: 2;
          background: #0f2a31;
          color: ${theme.textSecondary};
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          text-align: left;
          padding: 10px 12px;
          border-bottom: 1px solid ${theme.cardBorder};
        }
        .dlf-table thead th.sticky-col {
          left: 0;
          z-index: 3;
        }
        .dlf-table tbody td {
          padding: 9px 12px;
          border-bottom: 1px solid ${theme.cardBorder};
          vertical-align: top;
          background: ${theme.cardBg};
          color: ${theme.textPrimary};
          word-wrap: break-word;
          position: relative;
        }
        .dlf-table tbody td.sticky-col {
          position: sticky;
          left: 0;
          z-index: 1;
          background: #0c2129;
          font-weight: 600;
        }
        .data-row:hover td {
          background: ${theme.rowHoverBg};
        }
        .data-row:hover td.sticky-col {
          background: #102a30;
        }
        .section-row {
          background: ${theme.sectionRowBg} !important;
          color: ${theme.textPrimary};
          font-weight: 700;
          font-size: 13px;
          padding: 10px 12px;
          border-top: 1px solid ${theme.cardBorder};
          border-bottom: 1px solid ${theme.cardBorder};
        }
        .editable-cell {
          cursor: pointer;
          transition: background 0.1s ease;
        }
        .editable-cell:hover {
          background: ${theme.cellHoverBg} !important;
        }
        .notes-cell {
          cursor: default;
        }
        .notes-cell:hover {
          background: ${theme.cellHoverBg} !important;
        }
        .notes-render {
          cursor: pointer;
          display: block;
        }
        .edit-icon {
          opacity: 0;
          margin-left: 6px;
          font-size: 11px;
          color: ${theme.accent};
          transition: opacity 0.1s ease;
        }
        .editable-cell:hover .edit-icon,
        .notes-cell:hover .edit-icon {
          opacity: 1;
        }
        .editing-cell {
          background: ${theme.cellEditingBg} !important;
          padding: 5px 8px !important;
        }
        .editing-cell input {
          width: 100%;
          background: ${theme.pageBg};
          border: 1px solid ${theme.accent};
          border-radius: 4px;
          padding: 6px 8px;
          color: ${theme.textPrimary};
          font-size: 13px;
          font-family: inherit;
          outline: none;
          box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.15);
        }
        .mode-badge {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .mode-badge.mode-auto {
          color: ${theme.textMuted};
        }
        .mode-badge.mode-on {
          color: ${theme.highlightBg};
        }
        .mode-badge.mode-off {
          color: ${theme.textSecondary};
        }
        .edited-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: ${theme.editedDot};
          flex-shrink: 0;
          display: inline-block;
        }
        .notes-highlight {
          background: ${theme.highlightBg};
          color: ${theme.highlightText};
          padding: 0 1px;
          border-radius: 2px;
          line-height: 1.5;
        }
        .highlight-menu-wrap {
          position: absolute;
          top: 4px;
          right: 4px;
        }
        .highlight-icon-btn {
          opacity: 0;
          width: 20px;
          height: 20px;
          border-radius: 4px;
          border: none;
          background: transparent;
          font-size: 12px;
          line-height: 1;
          cursor: pointer;
          transition: opacity 0.1s ease, background 0.1s ease;
        }
        .notes-cell:hover .highlight-icon-btn,
        .highlight-icon-btn.active {
          opacity: 1;
        }
        .highlight-icon-btn:hover {
          background: ${theme.accentSoft};
        }
        .highlight-menu {
          position: absolute;
          top: 24px;
          right: 0;
          background: #0f2a31;
          border: 1px solid ${theme.cardBorder};
          border-radius: 6px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
          z-index: 5;
          min-width: 90px;
          overflow: hidden;
        }
        .highlight-menu-item {
          padding: 7px 12px;
          font-size: 12px;
          color: ${theme.textPrimary};
          cursor: pointer;
          white-space: nowrap;
        }
        .highlight-menu-item:hover {
          background: ${theme.accentSoft};
        }
        .highlight-menu-item.selected {
          color: ${theme.accent};
          font-weight: 700;
        }
        .bottom-spacer {
          height: 84px;
        }
        .action-bar-wrap {
          position: fixed;
          left: 50%;
          bottom: 0;
          transform: translateX(-50%);
          width: min(1700px, 96vw);
          z-index: 20;
          pointer-events: none;
        }
        .action-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 18px;
          background: ${theme.cardBg};
          border: 1px solid ${theme.cardBorder};
          border-bottom: none;
          border-radius: 10px 10px 0 0;
          box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.35);
          pointer-events: auto;
        }
      `}</style>
    </div>
  );
}

export { FIELD_COLUMNS, isRowEdited };
