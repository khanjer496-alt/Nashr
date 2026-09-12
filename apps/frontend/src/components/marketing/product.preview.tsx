import Image from 'next/image';
import { brand } from '@gitroom/nashr-brand/brand.config';
import styles from './landing.module.scss';

export function ProductPreview() {
  return (
    <figure className={styles.productPreview} aria-label={`${brand.name} workspace screenshot`}>
      <div className={styles.previewChrome}><div><i /><i /><i /></div><span>{brand.name} / publishing workspace</span><b>LOCAL PREVIEW</b></div>
      <Image src="/postdelegate-workspace-preview.png" width={1440} height={1000} alt="PostDelegate publishing workspace with queue, drafts, approvals and onboarding. No social channels are connected in this preview." style={{ width: '100%', height: 'auto', display: 'block' }} priority />
      <figcaption style={{ padding: '14px 20px', color: '#b9becc', fontSize: 13 }}>Actual development workspace · Test account · Customer access is not open yet.</figcaption>
    </figure>
  );
}
