import { useCallback, useRef, useState } from 'react';
import { theme, s } from '../styles/theme';

export function UploadStep({ onParsed }) {
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
    <div>
      <div style={s.sectionLabel}>STEP 1 — UPLOAD YOUR DELIVERY LOG</div>
      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
        onClick={() => status !== 'uploading' && inputRef.current?.click()}
        style={{
          ...s.card,
          borderStyle: 'dashed',
          borderColor: dragging ? theme.cardBorderHover : theme.cardBorder,
          background: dragging ? theme.accentSoft : theme.cardBg,
          padding: '56px 24px',
          textAlign: 'center',
          cursor: status === 'uploading' ? 'default' : 'pointer',
          transition: 'border-color 0.15s, background 0.15s',
          maxWidth: 480,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div style={{ fontSize: 34, marginBottom: 12 }}>📄</div>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: theme.accent, marginBottom: 10 }}>
          DELIVERY LOG
        </div>

        {status === 'uploading' ? (
          <div style={{ color: theme.textPrimary, fontSize: 14 }}>
            Parsing {fileName}…
          </div>
        ) : (
          <>
            <div style={{ color: theme.textPrimary, fontSize: 15, fontWeight: 600 }}>
              Click or drag &amp; drop
            </div>
            <div style={{ color: theme.textSecondary, fontSize: 13, marginTop: 4 }}>
              OPS Print Delivery Log
            </div>
          </>
        )}
      </div>

      {status === 'error' && (
        <div
          style={{
            marginTop: 16,
            maxWidth: 480,
            background: theme.dangerSoft,
            border: `1px solid ${theme.danger}`,
            borderRadius: 8,
            padding: '12px 16px',
            color: '#fecaca',
            fontSize: 13.5,
          }}
        >
          {errorMsg}
        </div>
      )}
    </div>
  );
}
