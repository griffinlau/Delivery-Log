import { useEffect, useRef, useState } from 'react';
import { theme, s } from '../styles/theme';
import { resolveHighlight, formatLongDate, formatTitleDateSuffix } from '../lib/deliveryLogRules';
import { isRowEdited } from './ReviewStep';

export function GenerateStep({ deliveryDate, records, originalRecords, onBack, onStartNew }) {
  const [status, setStatus] = useState('generating'); // generating | ready | error
  const [errorMsg, setErrorMsg] = useState('');
  const [pdfUrl, setPdfUrl] = useState(null);
  const printFrameRef = useRef(null);
  const generatedOnce = useRef(false);

  const dataRows = records.filter((r) => r.type === 'data');
  const sectionRows = records.filter((r) => r.type === 'section');
  const highlightedCount = dataRows.filter((r) => resolveHighlight(r.notes, r.highlight_mode)).length;
  const editedCount = records.reduce((sum, r, i) => {
    if (r.type !== 'data') return sum;
    return sum + (isRowEdited(r, originalRecords[i]) ? 1 : 0);
  }, 0);

  // The PDF title always reflects the confirmed Delivery Date (which may have
  // been auto-detected, defaulted to tomorrow, or manually corrected) — never
  // the raw title string from the original upload.
  const title = `OPS - Print Delivery Log - ${formatTitleDateSuffix(deliveryDate)}`;

  useEffect(() => {
    if (generatedOnce.current) return;
    generatedOnce.current = true;

    (async () => {
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, records }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Server error (${res.status})`);
        }
        const blob = await res.blob();
        setPdfUrl(URL.createObjectURL(blob));
        setStatus('ready');
      } catch (e) {
        setErrorMsg(e.message || 'Failed to generate the PDF.');
        setStatus('error');
      }
    })();

    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDownload() {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = 'delivery-log-formatted.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function handlePrint() {
    if (!pdfUrl || !printFrameRef.current) return;
    const frame = printFrameRef.current;
    frame.src = pdfUrl;
    frame.onload = () => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch (e) {
        window.open(pdfUrl, '_blank');
      }
    };
  }

  return (
    <div>
      <div style={s.sectionLabel}>STEP 3 — GENERATE</div>

      <div style={{ ...s.card, maxWidth: 560 }}>
        {status === 'generating' && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: theme.textSecondary }}>
            Generating your formatted PDF…
          </div>
        )}

        {status === 'error' && (
          <div
            style={{
              background: theme.dangerSoft,
              border: `1px solid ${theme.danger}`,
              borderRadius: 8,
              padding: '14px 16px',
              color: '#fecaca',
              fontSize: 13.5,
            }}
          >
            {errorMsg}
          </div>
        )}

        {status === 'ready' && (
          <>
            <div style={{ fontSize: 19, fontWeight: 800, color: theme.textPrimary, marginBottom: 6 }}>
              Delivery Log Ready
            </div>
            <div style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 20 }}>
              Delivery Date: {formatLongDate(deliveryDate)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <SummaryStat label="Orders" value={dataRows.length} />
              <SummaryStat label="Delivery windows" value={sectionRows.length} />
              <SummaryStat label="Highlighted notes" value={highlightedCount} />
              <SummaryStat label="Manual edits" value={editedCount} />
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <button style={{ ...s.primaryButton, flex: 1 }} onClick={handleDownload}>
                ↓ Download PDF
              </button>
              <button style={{ ...s.secondaryButton, flex: 1 }} onClick={handlePrint}>
                🖨 Print
              </button>
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, maxWidth: 560 }}>
        <button style={s.secondaryButton} onClick={onBack}>← Back to Review</button>
        <button style={s.secondaryButton} onClick={onStartNew}>Start New Delivery Log</button>
      </div>

      {/* Hidden iframe used to trigger printing of the actual generated PDF (not the webpage) */}
      <iframe ref={printFrameRef} style={{ display: 'none' }} title="print-frame" />
    </div>
  );
}

function SummaryStat({ label, value }) {
  return (
    <div
      style={{
        background: theme.cardBgAlt,
        border: `1px solid ${theme.cardBorder}`,
        borderRadius: 8,
        padding: '12px 14px',
      }}
    >
      <div style={{ fontSize: 11, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: theme.textPrimary, marginTop: 2 }}>{value}</div>
    </div>
  );
}
