import { useState } from 'react';
import { s } from '../styles/theme';
import { Header, StepBar, Footer } from '../components/Chrome';
import { UploadStep } from '../components/UploadStep';
import { ReviewStep } from '../components/ReviewStep';
import { GenerateStep } from '../components/GenerateStep';
import { tomorrowISODate, extractDateFromTitle, formatLongDate } from '../lib/deliveryLogRules';

export default function Home() {
  const [step, setStep] = useState(1);
  const [records, setRecords] = useState([]);
  const [originalRecords, setOriginalRecords] = useState([]);

  // Delivery date shown throughout the app — defaults to tomorrow, gets
  // auto-updated from the uploaded sheet's title if a reliable date can be
  // extracted, and is always user-editable. Once the user edits it directly,
  // it's never auto-overwritten again until Start New Delivery Log.
  const [deliveryDate, setDeliveryDate] = useState(() => tomorrowISODate());
  const [dateManuallySet, setDateManuallySet] = useState(false);

  function handleDeliveryDateChange(iso) {
    setDeliveryDate(iso);
    setDateManuallySet(true);
  }

  function handleParsed(data) {
    setRecords(data.records);
    setOriginalRecords(data.records.map((r) => ({ ...r })));

    if (!dateManuallySet) {
      const extracted = extractDateFromTitle(data.title);
      if (extracted) setDeliveryDate(extracted);
      // If extraction fails, keep whatever's already showing (the tomorrow default).
    }

    setStep(2);
  }

  function handleReset() {
    setRecords(originalRecords.map((r) => ({ ...r })));
  }

  function handleStartNew() {
    setStep(1);
    setRecords([]);
    setOriginalRecords([]);
    setDeliveryDate(tomorrowISODate());
    setDateManuallySet(false);
  }

  const widthStyle = step === 2 ? s.contentWide : s.contentNarrow;

  return (
    <div style={s.page}>
      <Header dateLabel={formatLongDate(deliveryDate)} />
      <StepBar currentStep={step} />
      <div style={{ ...s.content, ...widthStyle }}>
        {step === 1 && (
          <UploadStep
            onParsed={handleParsed}
            deliveryDate={deliveryDate}
            onDeliveryDateChange={handleDeliveryDateChange}
          />
        )}

        {step === 2 && (
          <ReviewStep
            records={records}
            originalRecords={originalRecords}
            deliveryDate={deliveryDate}
            onChange={setRecords}
            onBack={() => setStep(1)}
            onContinue={() => setStep(3)}
            onReset={handleReset}
          />
        )}

        {step === 3 && (
          <GenerateStep
            deliveryDate={deliveryDate}
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
