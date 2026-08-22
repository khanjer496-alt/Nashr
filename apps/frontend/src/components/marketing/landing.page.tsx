import Link from 'next/link';
import { brand } from '@gitroom/nashr-brand/brand.config';
import { PlatformSignals } from './platform.signals';
import { ProductPreview } from './product.preview';
import styles from './landing.module.scss';

const audiences = [
  ['◎', 'Teams & agencies', 'Plan every brand, collect approvals and keep clients in the loop from one calm workspace.'],
  ['◇', 'Creators & brands', 'Turn ideas into a consistent publishing rhythm without living inside every social app.'],
  ['⌁', 'Developers & agents', 'Use API, MCP and CLI interfaces to create, review and publish through the same governed system.'],
] as const;

const workflowSignals = [
  ['ONE WORKSPACE', 'Humans + agents'],
  ['EVERY CHANNEL', 'One publishing flow'],
  ['BUILT-IN CONTROL', 'Approvals + audit trail'],
] as const;

const interfaces = [
  ['Web', 'Available', 'The complete publishing workspace.'],
  ['API', 'Available', 'Structured access for products and workflows.'],
  ['MCP', 'Available', 'Controlled tools for compatible AI clients.'],
  ['CLI', 'In progress', 'Terminal-native publishing and JSON output.'],
] as const;

const faqs = [
  ['How do I get started?', 'Create a workspace, connect your channels and invite your team. Agent and developer interfaces use the same workspace when you need them.'],
  ['Is Orbiloom only for AI agents?', 'No. It is a complete social publishing workspace for people, with first-class interfaces for software and trusted agents.'],
  ['Which social channels can I connect?', 'Orbiloom supports major social platforms. Availability depends on each network’s current API and account requirements.'],
  ['Can agents publish without review?', 'Agent work begins as a draft unless your workspace explicitly permits autonomous publishing under its approval policy.'],
] as const;

export function LandingPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero} id="product">
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}><span className={styles.liveDot} />THE AGENTIC SOCIAL PUBLISHING WORKSPACE</div>
          <h1>{brand.heroLine}</h1>
          <p className={styles.heroDescriptor}>{brand.tagline}.</p>
          <p className={styles.heroBody}>Create, approve, schedule and analyze every channel—without losing control of the work that goes live.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/auth">Start free <span aria-hidden="true">↗</span></Link>
            <Link className={styles.secondaryAction} href="#in-action">See it in action <span aria-hidden="true">↓</span></Link>
          </div>
          <PlatformSignals />
        </div>
        <ProductPreview />
      </section>

      <section className={styles.proofSection} aria-label="Publishing workflow benefits">
        <p>Trusted by every part of your publishing workflow</p>
        <div className={styles.proofGrid}>
          {workflowSignals.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
        </div>
      </section>

      <section className={styles.section} id="for-teams">
        <div className={styles.centerHeading}>
          <span className={styles.monoLabel}>MADE FOR THE WHOLE WORKFLOW</span>
          <h2>Who is Orbiloom for?</h2>
          <p>One publishing system for the people and software moving your brand forward.</p>
        </div>
        <div className={styles.audienceGrid}>
          {audiences.map(([icon, title, body]) => (
            <article className={styles.audienceCard} key={title}>
              <span className={styles.audienceIcon} aria-hidden="true">{icon}</span>
              <h3>{title}</h3><p>{body}</p>
              <Link href="/auth">Start your workspace <span aria-hidden="true">↗</span></Link>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.actionSection}`} id="in-action">
        <div className={styles.centerHeading}>
          <span className={styles.monoLabel}>THE PRODUCT, NOT THE PROMISE</span>
          <h2>See Orbiloom in action</h2>
          <p>From a rough idea to an approved, scheduled post in one continuous flow.</p>
        </div>
        <div className={styles.actionStage}>
          <div className={styles.actionTopbar}><span>ORBIT / CAMPAIGN CALENDAR</span><div><i /><i /><i /></div></div>
          <div className={styles.actionLayout}>
            <aside><strong>August</strong><span className={styles.activeNav}>Calendar</span><span>Drafts</span><span>Approvals</span><span>Analytics</span></aside>
            <div className={styles.calendarMock}>
              {Array.from({ length: 15 }).map((_, index) => <div key={index}><span>{index + 12}</span>{[1, 4, 7, 10, 13].includes(index) && <i />}{[2, 8, 11].includes(index) && <b />}</div>)}
            </div>
          </div>
          <div className={styles.playBadge} aria-hidden="true"><span>▶</span></div>
          <p className={styles.actionCaption}>Plan → create → approve → publish</p>
        </div>
      </section>

      <section className={`${styles.section} ${styles.automationSection}`} id="capabilities">
        <div className={styles.sectionHeading}>
          <span className={styles.monoLabel}>MORE OUTPUT. LESS OPERATIONAL DRAG.</span>
          <h2>Power your content with AI and automation</h2>
          <p>Keep the speed of automation and the judgment of your team in the same workflow.</p>
        </div>
        <div className={styles.featureGrid}>
          <article className={`${styles.featurePanel} ${styles.aiPanel}`}>
            <span className={styles.panelLabel}>AI COPILOT</span><h3>Turn a brief into channel-ready drafts.</h3>
            <p>Generate options, adapt tone and request approval without leaving the composer.</p>
            <div className={styles.chatMock}><div><span>YOU</span><p>Turn the launch brief into a concise LinkedIn post.</p></div><div><span>ORBILOOM</span><p>Draft ready. I kept the product claim precise and added one clear CTA.</p></div></div>
          </article>
          <article className={`${styles.featurePanel} ${styles.schedulePanel}`}>
            <span className={styles.panelLabel}>SMART SCHEDULING</span><h3>Publish at the right moment.</h3>
            <p>Coordinate timing across channels while every post stays attached to its campaign.</p>
            <div className={styles.postMock}><div className={styles.postAvatar}>O</div><div><strong>Orbiloom</strong><span>LinkedIn · Tomorrow 09:30</span></div><p>One campaign. Every channel in motion.</p><div className={styles.postMedia}>READY TO PUBLISH</div></div>
          </article>
          <article className={styles.miniFeature}><span>01</span><h3>Calendar</h3><p>See every campaign, draft and scheduled post.</p></article>
          <article className={styles.miniFeature}><span>02</span><h3>Approvals</h3><p>Review human and agent work under one policy.</p></article>
          <article className={styles.miniFeature}><span>03</span><h3>Analytics</h3><p>Connect performance back to the publishing plan.</p></article>
          <article className={styles.miniFeature}><span>04</span><h3>Media</h3><p>Keep reusable production assets organized on R2.</p></article>
        </div>
      </section>

      <section className={`${styles.section} ${styles.interfaceSection}`} id="interfaces">
        <div className={styles.interfaceCopy}>
          <span className={styles.monoLabel}>FIRST-CLASS INTERFACES</span><h2>Web for people.<br />Tools for agents.</h2>
          <p>{brand.campaignLine} Use the interface that fits the work without creating a second publishing system.</p>
          <div className={styles.codeBlock}><div><span>$</span> orbiloom draft create --channels x,linkedin</div><div className={styles.codeResponse}>→ draft created · approval requested</div></div>
        </div>
        <div className={styles.interfaceList}>
          {interfaces.map(([name, status, body]) => <article key={name}><div><h3>{name}</h3><span className={status === 'In progress' ? styles.statusProgress : styles.statusLive}>{status}</span></div><p>{body}</p></article>)}
        </div>
      </section>

      <section className={`${styles.section} ${styles.pricingSection}`} id="pricing">
        <div className={styles.centerHeading}><span className={styles.monoLabel}>START WITHOUT THE GUESSWORK</span><h2>Build your publishing orbit.</h2><p>Create your workspace today. Public plans will be published before billing begins.</p></div>
        <div className={styles.pricingCard}><span className={styles.panelLabel}>MANAGED CLOUD</span><h3>Start with Orbiloom</h3><p>One workspace for your team, channels and trusted agents.</p><Link href="/auth">Start free ↗</Link></div>
      </section>

      <section className={`${styles.section} ${styles.faqSection}`} id="faq">
        <div className={styles.sectionHeadingCompact}><span className={styles.monoLabel}>CLEAR ANSWERS</span><h2>Before you connect.</h2></div>
        <div className={styles.faqList}>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
      </section>

      <section className={styles.finalCta}>
        <span className={styles.monoLabel}>YOUR NEXT SIGNAL</span><h2>{brand.heroLine}</h2>
        <p>Bring your team, channels and trusted agents into one intelligent orbit.</p>
        <Link className={styles.limeAction} href="/auth">Start free <span aria-hidden="true">↗</span></Link>
      </section>
    </div>
  );
}
