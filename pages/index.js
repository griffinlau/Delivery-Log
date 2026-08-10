import { useMemo, useState } from 'react';
import { s, theme } from '../styles/theme';
import { Header, StepBar, Footer } from '../components/Chrome';
import { UploadStep } from '../components/UploadStep';
import { ReviewStep } from '../components/ReviewStep';
import { GenerateStep } from '../components/GenerateStep';

function todayLabel() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function Home() {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [records, setRecords] = useState([]);
  const [originalRecords, setOriginalRecords] = useState([]);
  const dateLabel = useMemo(() => todayLabel(), []);

  function handleParsed(data) {
    setTitle(data.title || 'OPS - Print Delivery Log');
    setRecords(data.records);
    setOriginalRecords(data.records.map((r) => ({ ...r })));
    setStep(2);
  }

  function handleReset() {
    setRecords(originalRecords.map((r) => ({ ...r })));
  }

  function handleStartNew() {
    setStep(1);
    setTitle('');
    setRecords([]);
    setOriginalRecords([]);
  }

  return (
    <div style={s.page}>
      <Header dateLabel={dateLabel} />
      <StepBar currentStep={step} />
      <div style={s.content}>
        {step === 1 && <UploadStep onParsed={handleParsed} />}

        {step === 2 && (
          <ReviewStep
            records={records}
            originalRecords={originalRecords}
            onChange={setRecords}
            onBack={() => setStep(1)}
            onContinue={() => setStep(3)}
            onReset={handleReset}
          />
        )}

        {step === 3 && (
          <GenerateStep
            title={title}
            records={records}
            originalRecords={originalRecords}
            onBack={() => setStep(2)}
            onStartNew={handleStartNew}
          />
        )}
      </div>
      <Footer />
    </div>
  );
}
