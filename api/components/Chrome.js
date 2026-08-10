import { theme, s } from '../styles/theme';

export function Header({ dateLabel }) {
  return (
    <div style={s.header}>
      <div style={s.headerLeft}>
        <div style={s.logoBox}>
          <div style={s.logoText}>BI-RITE</div>
          <div style={s.logoSub}>EAT GOOD FOOD</div>
        </div>
        <div>
          <h1 style={s.toolTitle}>Delivery Log Formatter</h1>
          <div style={s.toolSubtitle}>OPERATIONS TOOL</div>
        </div>
      </div>
      <div style={s.headerDate}>{dateLabel}</div>
    </div>
  );
}

const STEP_LABELS = ['Upload Delivery Log', 'Review & Edit', 'Generate'];

export function StepBar({ currentStep }) {
  return (
    <div style={s.stepBar}>
      {STEP_LABELS.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isDone = stepNum < currentStep;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                background: isActive || isDone ? theme.accent : 'transparent',
                color: isActive || isDone ? '#04211d' : theme.textMuted,
                border: isActive || isDone ? 'none' : `1px solid ${theme.textMuted}`,
              }}
            >
              {stepNum}
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? theme.textPrimary : theme.textMuted,
              }}
            >
              {label}
            </span>
            {stepNum < 3 && (
              <div style={{ width: 40, height: 1, background: theme.cardBorder, marginLeft: 6 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Footer() {
  return <div style={s.footer}>POWERED BY BI-RITE OPERATIONS · DESIGNED &amp; CREATED BY GRIFFIN LAU</div>;
}
