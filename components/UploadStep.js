import { useCallback, useRef, useState } from 'react';
import { theme, s } from '../styles/theme';

export function UploadStep({ onParsed, deliveryDate, onDeliveryDateChange }) {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | uploading | error
  const [errorMsg, setErrorMsg] = useState('');
  const [fileName, setFileName] = useState('');
  const inputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('Please upload a PDF file.');
      setStatus('error');
      return;
    }
    setFileName(file.name);
    setStatus('uploading');
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/parse', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Server error (${res.status})`);
      }
      onParsed(data);
    } catch (e) {
      setErrorMsg(e.message || 'Something went wrong while parsing this PDF.');
      setStatus('error');
    }
  }, [onParsed]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }, [handleFile]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 24 }}>
      <div style={{ ...s.sectionLabel, textAlign: 'center' }}>STEP 1 — UPLOAD YOUR DELIVERY LOG</div>

      <div style={{ ...s.card, width: '100%', maxWidth: 660, marginBottom: 20, padding: '18px 22px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: theme.accent, marginBottom: 8 }}>
          DELIVERY DATE
        </div>
        <input
          type="date"
          value={deliveryDate}
          onChange={(e) => onDeliveryDateChange(e.target.value)}
          style={{
            background: theme.pageBg,
            border: `1px solid ${theme.cardBorder}`,
            borderRadius: 6,
            padding: '10px 12px',
            color: theme.textPrimary,
            fontSize: 14,
            fontFamily: theme.fontFamily,
            colorScheme: 'dark',
            outline: 'none',
          }}
        />
        <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 8, lineHeight: 1.5 }}>
          Defaults to tomorrow, or is detected automatically from the uploaded sheet once you
          drop it in below — change it here any time if it's not correct.
        </div>
      </div>

      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
        onClick={() => status !== 'uploading' && inputRef.current?.click()}
        style={{
          ...s.card,
          width: '100%',
          maxWidth: 660,
          borderStyle: 'dashed',
          borderWidth: 2,
          borderColor: dragging ? theme.cardBorderHover : theme.cardBorder,
          background: dragging ? theme.accentSoft : theme.cardBg,
          padding: '72px 32px',
          textAlign: 'center',
          cursor: status === 'uploading' ? 'default' : 'pointer',
          transition: 'border-color 0.15s ease, background 0.15s ease',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div style={{ fontSize: 40, marginBottom: 18, opacity: 0.9 }}>📄</div>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: theme.accent, marginBottom: 14 }}>
          DELIVERY LOG
        </div>

        {status === 'uploading' ? (
          <div style={{ color: theme.textPrimary, fontSize: 15 }}>
            Parsing {fileName}…
          </div>
        ) : (
          <>
            <div style={{ color: theme.textPrimary, fontSize: 17, fontWeight: 700 }}>
              Click or drag &amp; drop
            </div>
            <div style={{ color: theme.textSecondary, fontSize: 13.5, marginTop: 6 }}>
              OPS Print Delivery Log
            </div>
          </>
        )}
      </div>

      {status === 'error' && (
        <div
          style={{
            marginTop: 18,
            width: '100%',
            maxWidth: 660,
            background: theme.dangerSoft,
            border: `1px solid ${theme.danger}`,
            borderRadius: 8,
            padding: '12px 16px',
            color: '#fecaca',
            fontSize: 13.5,
            textAlign: 'center',
          }}
        >
          {errorMsg}
        </div>
      )}
    </div>
  );
}
