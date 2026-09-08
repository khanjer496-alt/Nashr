import { brand } from '@gitroom/nashr-brand/brand.config';
import styles from './landing.module.scss';

export function ProductPreview() {
  return (
    <div className={styles.productPreview} aria-label={`${brand.name} post composer and approval workflow preview`}>
      <div className={styles.previewChrome}><div><i /><i /><i /></div><span>{brand.name} / composer</span><b>LIVE</b></div>
      <div className={styles.previewBody}>
        <aside className={styles.previewRail}><strong>{brand.name[0]}</strong><span className={styles.railActive}>＋</span><span>⌂</span><span>▦</span><span>◫</span><span>⌁</span></aside>
        <section className={styles.composerPane}>
          <div className={styles.composerHeading}><div><span>NEW POST</span><h3>Create a post</h3></div><button type="button">Save draft</button></div>
          <div className={styles.channelRow}><span className={styles.channelActive}>in</span><span>𝕏</span><span>◎</span><span>▶</span></div>
          <div className={styles.composerInput}><p>One campaign. Every channel in motion.</p><span>Share the launch across LinkedIn and X with a confident, concise tone.</span><div className={styles.inputTools}><i>＋</i><i>AI</i><i>☺</i><b>118 / 3000</b></div></div>
          <div className={styles.mediaTile}><span>{brand.name.toUpperCase()}</span><strong>Put every channel<br />in motion.</strong></div>
          <div className={styles.composerFooter}><span>Tomorrow · 09:30</span><button type="button">Request approval</button></div>
        </section>
        <aside className={styles.reviewPane}>
          <span className={styles.reviewLabel}>WORKFLOW</span><h3>Ready for review</h3>
          <div className={styles.reviewCard}><i>✓</i><div><strong>Policy check</strong><span>Claims and links verified</span></div></div>
          <div className={styles.reviewCard}><i>2</i><div><strong>Channels selected</strong><span>LinkedIn and X</span></div></div>
          <div className={styles.approvalState}><i>→</i><div><strong>Approval requested</strong><span>Waiting for Naser</span></div></div>
        </aside>
      </div>
    </div>
  );
}
