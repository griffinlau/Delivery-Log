import { useCallback, useRef, useState } from 'react';

const STATES = {
  IDLE: 'idle',
  DRAGGING: 'dragging',
  PROCESSING: 'processing',
  DONE: 'done',
  ERROR: 'error',
};

export default function Home() {
  const [state, setState] = useState(STATES.IDLE);
  const [errorMsg, setErrorMsg] = useState('');
  const [fileName, setFileName] = useState('');
  const inputRef = useRef(null);

  const processFile = useCallback(async (file) => {
    if (!file || file.type !== 'application/pdf') {
      setErrorMsg('Please drop a PDF file.');
      setState(STATES.ERROR);
      return;
    }
    setFileName(file.name);
    setState(STATES.PROCESSING);
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/process', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'delivery-log-formatted.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setState(STATES.DONE);
    } catch (e) {
      setErrorMsg(e.message || 'Something went wrong.');
      setState(STATES.ERROR);
    }
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    processFile(e.dataTransfer.files?.[0]);
  }, [processFile]);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setState(STATES.DRAGGING);
  }, []);

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    setState(STATES.IDLE);
  }, []);

  const onPick = useCallback((e) => {
    processFile(e.target.files?.[0]);
  }, [processFile]);

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <h1 style={styles.title}>Delivery Log Formatter</h1>
        <p style={styles.subtitle}>
          Drop in the raw OPS - Print Delivery Log PDF. Get back the finished version:
          headers repeated on every page, Stage Time calculated, and notes highlighted.
        </p>

        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          style={{
            ...styles.dropzone,
            ...(state === STATES.DRAGGING ? styles.dropzoneActive : {}),
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            onChange={onPick}
            style={{ display: 'none' }}
          />

          {state === STATES.PROCESSING ? (
            <p style={styles.dropText}>Processing {fileName}…</p>
          ) : state === STATES.DONE ? (
            <p style={styles.dropText}>✓ Done — {fileName} downloaded. Drop another to run again.</p>
          ) : (
            <p style={styles.dropText}>Drag a PDF here, or click to choose a file</p>
          )}
        </div>

        {state === STATES.ERROR && <p style={styles.error}>{errorMsg}</p>}

        <ul style={styles.rules}>
          <li>Stage Time = Departure Time minus 30 minutes, rounded to the nearest 5 minutes</li>
          <li>Notes are highlighted yellow when they mention hot food, coffee, salsa, boxed meals, HH, alcohol, or bev(s) — the item count and "bag" stay unhighlighted</li>
          <li>Column headers repeat at the top of every page</li>
        </ul>
      </div>
    </main>
  );
}

const styles = {
  main: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f5f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    padding: '24px',
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: 32,
    maxWidth: 560,
    width: '100%',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  title: { fontSize: 22, fontWeight: 700, margin: 0, color: '#1a1a1a' },
  subtitle: { fontSize: 14, color: '#555', marginTop: 8, marginBottom: 24, lineHeight: 1.5 },
  dropzone: {
    border: '2px dashed #ccc',
    borderRadius: 10,
    padding: '40px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
  },
  dropzoneActive: { borderColor: '#3b82f6', background: '#eff6ff' },
  dropText: { margin: 0, color: '#333', fontSize: 14 },
  error: { color: '#b91c1c', fontSize: 13, marginTop: 12 },
  rules: { marginTop: 24, paddingLeft: 18, fontSize: 12.5, color: '#666', lineHeight: 1.6 },
};
