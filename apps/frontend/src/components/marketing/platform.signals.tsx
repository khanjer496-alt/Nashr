import Image from 'next/image';
import { brand } from '@gitroom/nashr-brand/brand.config';
import styles from './landing.module.scss';

const platforms = [
  ['x', 'X'],
  ['linkedin', 'LinkedIn'],
  ['instagram', 'Instagram'],
  ['youtube', 'YouTube'],
  ['tiktok', 'TikTok'],
  ['threads', 'Threads'],
  ['bluesky', 'Bluesky'],
  ['reddit', 'Reddit'],
] as const;

export function PlatformSignals() {
  return (
    <div className={styles.platformSignals} aria-label={brand.publicPreview ? 'Planned social integrations; approvals not verified' : 'Supported social channels include'}>
      {platforms.map(([asset, label], index) => (
        <div
          className={styles.platformSignal}
          style={{ '--signal-index': index } as React.CSSProperties}
          key={asset}
        >
          <Image
            src={`/icons/platforms/${asset}.png`}
            width={28}
            height={28}
            alt=""
          />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
