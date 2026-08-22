import styles from './landing.module.scss';

const orbitSteps = [
  { label: 'Draft', meta: 'Human or agent', className: styles.stepDraft },
  { label: 'Review', meta: 'Policy checked', className: styles.stepReview },
  { label: 'Publish', meta: '3 channels', className: styles.stepPublish },
] as const;

export function PublishingOrbit() {
  return (
    <div className={styles.orbitDemo} aria-label="A draft moving through review to connected channels">
      <div className={styles.orbitGlow} aria-hidden="true" />
      <svg
        className={styles.orbitLines}
        viewBox="0 0 1000 480"
        fill="none"
        aria-hidden="true"
      >
        <path d="M82 312C185 72 610 23 862 171C1086 302 751 466 444 417C185 376 92 243 236 136" />
        <path d="M118 159C270 34 685 101 876 301C1015 447 670 474 380 371C137 284 30 229 118 159Z" />
      </svg>
      <div className={styles.orbitNode} aria-hidden="true" />
      <div className={styles.orbitCore}>
        <span className={styles.monoLabel}>PUBLISHING SYSTEM</span>
        <strong>One governed orbit</strong>
        <p>Permissions, approvals and audit history stay consistent.</p>
      </div>
      {orbitSteps.map((step, index) => (
        <div className={`${styles.orbitStep} ${step.className}`} key={step.label}>
          <span className={styles.stepIndex}>0{index + 1}</span>
          <strong>{step.label}</strong>
          <span>{step.meta}</span>
        </div>
      ))}
    </div>
  );
}
