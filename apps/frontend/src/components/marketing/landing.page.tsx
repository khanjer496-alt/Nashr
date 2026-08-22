import Link from 'next/link';
import { brand } from '@gitroom/nashr-brand/brand.config';
import { PlatformSignals } from './platform.signals';
import { PublishingOrbit } from './publishing.orbit';
import styles from './landing.module.scss';

const audiences = [
  {
    number: '01',
    title: 'Workspace',
    body: 'Plan calendars, create drafts, collect approvals and measure results in a complete browser workspace.',
    action: 'Start in the workspace',
    href: '/auth',
  },
  {
    number: '02',
    title: 'AI agents',
    body: 'Let trusted agents research, draft and request consequential actions under your workspace policy.',
    action: 'Explore agent workflows',
    href: '#interfaces',
  },
  {
    number: '03',
    title: 'Developers',
    body: 'Build on the same organizations, channels and publishing pipeline through structured interfaces.',
    action: 'See every interface',
    href: '#interfaces',
  },
] as const;

const capabilities = [
  ['Calendar', 'See campaigns, drafts and scheduled posts in one operational view.'],
  ['Approvals', 'Route human and agent work through the same publishing policy.'],
  ['Media', 'Organize reusable assets and keep production media on Cloudflare R2.'],
  ['Analytics', 'Read channel performance without separating it from the publishing workflow.'],
  ['Localization', 'Work naturally across English, Arabic, RTL layouts and bilingual approvals.'],
  ['Automation', 'Connect tools and agents without creating a second, ungoverned publishing path.'],
] as const;

const interfaces = [
  ['Web', 'Available', 'The complete workspace for teams, creators and agencies.'],
  ['API', 'Available', 'Operate channels, drafts and publishing from your own products.'],
  ['MCP', 'Available', 'Give compatible AI clients structured tools with controlled actions.'],
  ['CLI', 'In progress', 'Terminal-native workflows and deterministic JSON output are being completed.'],
] as const;

const faqs = [
  ['Is Orbiloom open source?', `Yes. ${brand.upstream.attribution}, and Orbiloom is distributed under ${brand.upstream.license}.`],
  ['Is this only for AI agents?', 'No. People get a complete publishing workspace. Agents and applications use first-class interfaces to the same governed system.'],
  ['Does Orbiloom support Arabic?', 'Yes. Arabic, RTL layouts, bilingual workflows, regional dialect support and Hijri campaign planning remain deep localization capabilities.'],
  ['Can agents publish without review?', 'Generated work starts as a draft unless a workspace explicitly enables autonomous publishing and the central approval policy permits it.'],
] as const;

export function LandingPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero} id="product">
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>
            <span className={styles.liveDot} />
            OPEN SOURCE · AGENT-READY
          </div>
          <h1>{brand.heroLine}</h1>
          <p className={styles.heroDescriptor}>{brand.tagline}.</p>
          <p className={styles.heroBody}>
            Plan, approve, schedule and analyze in the workspace—or connect
            software and trusted agents through the same publishing system.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/auth">
              Start free <span aria-hidden="true">↗</span>
            </Link>
            <Link className={styles.secondaryAction} href="#interfaces">
              Explore interfaces <span aria-hidden="true">↓</span>
            </Link>
          </div>
          <PlatformSignals />
        </div>
        <PublishingOrbit />
      </section>

      <section className={styles.section} id="for-teams">
        <div className={styles.sectionHeading}>
          <span className={styles.monoLabel}>WHO MOVES WITH ORBILOOM</span>
          <h2>One system.<br />Three ways in.</h2>
          <p>The interface changes. Your workspace, permissions and publishing history do not.</p>
        </div>
        <div className={styles.audienceGrid}>
          {audiences.map((audience) => (
            <article className={styles.audienceCard} key={audience.title}>
              <span className={styles.cardNumber}>{audience.number}</span>
              <h3>{audience.title}</h3>
              <p>{audience.body}</p>
              <Link href={audience.href}>{audience.action} <span aria-hidden="true">↗</span></Link>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.capabilitySection}`} id="capabilities">
        <div className={styles.sectionHeadingCompact}>
          <span className={styles.monoLabel}>THE OPERATING LAYER</span>
          <h2>From idea to signal.</h2>
          <p>Creative workflow and publishing infrastructure belong in the same room.</p>
        </div>
        <div className={styles.capabilityGrid}>
          {capabilities.map(([title, body], index) => (
            <article className={index === 0 || index === 4 ? styles.capabilityWide : styles.capabilityCard} key={title}>
              <span className={styles.capabilityGlyph} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.interfaceSection}`} id="interfaces">
        <div className={styles.interfaceCopy}>
          <span className={styles.monoLabel}>FIRST-CLASS INTERFACES</span>
          <h2>Web for people.<br />Tools for agents.</h2>
          <p>{brand.campaignLine} Choose the interface that fits the work without giving up control.</p>
          <div className={styles.codeBlock}>
            <div><span>$</span> orbiloom draft create --channels x,linkedin</div>
            <div className={styles.codeResponse}>→ draft created · approval requested</div>
          </div>
        </div>
        <div className={styles.interfaceList}>
          {interfaces.map(([name, status, body]) => (
            <article key={name}>
              <div>
                <h3>{name}</h3>
                <span className={status === 'In progress' ? styles.statusProgress : styles.statusLive}>{status}</span>
              </div>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.localizationSection}`} id="global">
        <div className={styles.localeVisual} dir="rtl" lang="ar">
          <span>أوربيلوم</span>
          <strong>{brand.heroLineAr}</strong>
          <div className={styles.localeChips}>
            <span>العربية</span><span>RTL</span><span>ثنائي اللغة</span>
          </div>
        </div>
        <div className={styles.localeCopy}>
          <span className={styles.monoLabel}>GLOBAL BY DEFAULT</span>
          <h2>Local when the message demands it.</h2>
          <p>
            Arabic, RTL, bilingual approvals, dialect-aware workflows and
            Ramadan, Eid and Hijri planning are product depth—not a regional box.
          </p>
          <ul>
            <li>Natural first-paint RTL layouts</li>
            <li>English and Arabic in one workspace</li>
            <li>Optional regional campaign calendars</li>
          </ul>
        </div>
      </section>

      <section className={`${styles.section} ${styles.openSection}`} id="open-source">
        <div>
          <span className={styles.monoLabel}>OPEN AT THE FOUNDATION</span>
          <h2>Built on Postiz.<br />Open to inspect.</h2>
        </div>
        <div>
          <p>
            Orbiloom keeps Postiz as the underlying engine and is distributed
            under AGPL-3.0. Run it, study it and build on a publishing system
            whose source is visible.
          </p>
          <div className={styles.inlineActions}>
            <Link href={brand.sourceUrl}>View source ↗</Link>
            <Link href={brand.licensesUrl}>Licences and attribution →</Link>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.pricingSection}`} id="pricing">
        <div className={styles.sectionHeadingCompact}>
          <span className={styles.monoLabel}>START YOUR WAY</span>
          <h2>Open source now.<br />Cloud plans next.</h2>
          <p>No invented launch price. Self-host from the public source today, or start a workspace while managed cloud plans are finalized.</p>
        </div>
        <div className={styles.pricingCards}>
          <article>
            <span className={styles.cardNumber}>SELF-HOST</span>
            <h3>Run the source</h3>
            <p>Deploy the AGPL application on infrastructure you control.</p>
            <Link href={brand.sourceUrl}>Open repository ↗</Link>
          </article>
          <article className={styles.pricingFeatured}>
            <span className={styles.cardNumber}>MANAGED CLOUD</span>
            <h3>Start with Orbiloom</h3>
            <p>Create your workspace now. Final public plans will be published before billing is enabled.</p>
            <Link href="/auth">Start free ↗</Link>
          </article>
        </div>
      </section>

      <section className={`${styles.section} ${styles.faqSection}`} id="faq">
        <div className={styles.sectionHeadingCompact}>
          <span className={styles.monoLabel}>CLEAR ANSWERS</span>
          <h2>Before you connect.</h2>
        </div>
        <div className={styles.faqList}>
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}<span aria-hidden="true">+</span></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <span className={styles.monoLabel}>YOUR NEXT SIGNAL</span>
        <h2>{brand.heroLine}</h2>
        <p>Bring your team, channels and trusted agents into one intelligent orbit.</p>
        <Link className={styles.limeAction} href="/auth">Start free <span aria-hidden="true">↗</span></Link>
      </section>
    </div>
  );
}
