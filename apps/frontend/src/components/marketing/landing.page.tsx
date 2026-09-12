import Link from 'next/link';
import Image from 'next/image';
import { brand } from '@gitroom/nashr-brand/brand.config';
import { PlatformSignals } from './platform.signals';
import { ProductPreview } from './product.preview';
import styles from './landing.module.scss';

const faqs = [
  [
    "Can I use PostDelegate without an AI agent?",
    "Yes. Create drafts, add media and schedule posts directly in the web workspace. Connecting an agent is optional."
  ],
  [
    "Which social platforms does PostDelegate support?",
    "The current app includes integrations for Facebook, Instagram, LinkedIn, TikTok, YouTube, Pinterest, Threads, Bluesky, Google Business, Mastodon and DEV.to. Public account connections are not open yet. Available features depend on platform permissions and account requirements; see the platform guides for details."
  ],
  [
    "Can I post to several channels and customize each version?",
    "Yes. Prepare a shared post, choose its destinations and adjust supported per-channel options. Each channel has its own publishing result, so you can see whether one succeeded while another needs attention."
  ],
  [
    "What counts as a social account, and can I connect more than one?",
    "A social account is an individual destination, such as an Instagram profile or a Facebook Page. The app can manage multiple accounts on the same network. Paid-plan account limits have not been announced; we are not promising unlimited accounts."
  ],
  [
    "Can I schedule videos, images and carousels?",
    "The app supports text, image and video workflows, including multi-image posts on supported networks. Formats, dimensions, duration and account-type restrictions vary by destination. Check the relevant platform guide before preparing your media."
  ],
  [
    "Can I repeat posts on a schedule?",
    "Yes. The app includes recurring-post rules and a publishing queue. Review the content and destination rules before repeating it. This does not mean every RSS feed is automatically republished or that all networks permit the same repeating workflow."
  ],
  [
    "How do I connect an AI agent or use the API?",
    "Use the MCP endpoint with a compatible client, or send requests through the REST API. Authorize the workspace and accounts the client needs. Our agent guides cover MCP, the API, Claude Cowork and Codex; client-specific installations still need verification against a live deployment."
  ],
  [
    "Does PostDelegate generate content for me?",
    "You can bring content from your own AI client. PostDelegate gives that client tools to work with drafts, media and schedules. A built-in AI text, image or video generation subscription is not included in this preview."
  ],
  [
    "Can my team or clients approve posts before publishing?",
    "Yes. Workspace roles and approval settings control who can create, review and publish. The app includes internal review and client approval stages. These controls also apply to content prepared by an agent."
  ],
  [
    "Can I manage several brands or clients?",
    "Yes. Separate workspaces help organize accounts, content and access for different brands or clients. Team-member and workspace allowances for paid plans will be published before billing begins."
  ],
  [
    "What analytics can I see?",
    "The app includes channel and post analytics. The available metrics and history depend on what each platform exposes and which permissions are granted. We do not currently promise identical reporting across every network, downloadable reports or best-time recommendations."
  ],
  [
    "What happens if a post fails?",
    "Check the publishing status and error for each channel in the workspace. You may need to reconnect an account or adjust the post. An uncertain publishing result needs review before trying again, because the platform may already have accepted it."
  ],
  [
    "Do I need to share my social media password?",
    "Most supported connections use the platform’s authorization flow. Some integrations use a dedicated API token or app password, such as a Bluesky app password. Follow the connection instructions; do not put account credentials into an agent prompt."
  ],
  [
    "Will using a scheduler affect my reach?",
    "We do not guarantee reach, engagement or equal performance compared with manual posting. Results depend on your content, audience and the platform. Use the available analytics to assess your own results."
  ],
  [
    "How much will it cost, and what are the posting limits?",
    "Pricing, account allowances and posting limits have not been announced. The public site is a preview, not an active paid subscription service. Plans and their limits will be published before we accept payments."
  ],
  [
    "Will there be a free trial, cancellation and refunds?",
    "Trial, cancellation and refund terms are not finalized. We will publish those terms before accepting subscriptions. No trial duration, refund period or cancellation policy is being promised on this preview."
  ],
  [
    "When can I start, and where can I get help?",
    "Customer signup and social publishing are not open yet. Check Launch status for availability and Support for current contact information. The free caption checker and UTM builder can already be used without an account."
  ]
] as const;

export function LandingPage() {
  const entryHref = brand.publicPreview ? '/status' : `${brand.workspaceUrl}/accounts/login/`;
  const entryLabel = brand.publicPreview ? 'View launch status' : 'Open workspace';
  return (
    <div className={styles.page}>
      <section className={styles.hero} id="product">
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <fieldset className={styles.publishMode}>
            <legend>How do you like to post?</legend>
            <div className={styles.modeOptions}>
              <input type="radio" name="publishing-mode" id="publish-agents" value="agents" defaultChecked />
              <label htmlFor="publish-agents">AI agents</label>
              <input type="radio" name="publishing-mode" id="publish-scheduling" value="scheduling" />
              <label htmlFor="publish-scheduling">Social scheduling</label>
            </div>
          </fieldset>
          <h1>
            <span className={styles.modeAgents}>Schedule social posts<br />with your AI agent.</span>
            <span className={styles.modeScheduling}>Your social media schedule.<br />All in one place.</span>
          </h1>
          <p className={styles.heroBody}>
            <span className={styles.modeAgents}>Connect your AI agent to draft and schedule posts across your social channels. Check the content, approvals and publishing results in one workspace.</span>
            <span className={styles.modeScheduling}>Plan your content, schedule posts across your channels and track what goes live. Create on your own or work with your team—all from one calendar.</span>
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href={entryHref}>{entryLabel} <span aria-hidden="true">↗</span></Link>
            <Link className={styles.secondaryAction} href="#in-action">Explore the workspace <span aria-hidden="true">↓</span></Link>
          </div>
          <PlatformSignals />
          {brand.publicPreview && <p className={styles.heroBody}>Product preview · Customer signup and publishing are not open yet.</p>}
        </div>
        <ProductPreview />
      </section>

      <section className={`${styles.section} ${styles.productStory}`} id="capabilities">
        <div className={styles.storyCopy}>
          <span className={styles.monoLabel}>CREATE & CUSTOMIZE</span>
          <h2>One place to get your next post ready.</h2>
          <p>Add your copy and media, choose your channels and prepare the details before publishing. Everything stays with the draft.</p>
          <ul className={styles.checkList}>
            <li>Adjust content and options for each supported channel.</li>
            <li>Keep reusable images and videos in your media library.</li>
            <li>Save ideas and unfinished posts for later.</li>
          </ul>
          <a className={styles.textLink} href="#in-action">See how it works <span aria-hidden="true">↓</span></a>
        </div>
        <figure className={styles.storyScreenshot}>
          <div className={styles.screenshotLabel}>THE POSTDELEGATE COMPOSER</div>
          <Image src="/postdelegate-composer-preview.png" width={1440} height={1000} alt="The actual PostDelegate composer with caption, media, tags and draft controls in a local test workspace." style={{ width: '100%', height: 'auto', display: 'block' }} />
          <figcaption>Actual app preview · No social accounts connected.</figcaption>
        </figure>
      </section>

      <section className={`${styles.section} ${styles.workflowSection}`} id="in-action">
        <div className={styles.centerHeading}>
          <span className={styles.monoLabel}>HOW IT WORKS</span>
          <h2><span className={styles.modeAgents}>From your agent to your calendar.</span><span className={styles.modeScheduling}>From your first draft to your next post.</span></h2>
          <p>Different ways to create. The same place to review and schedule.</p>
        </div>
        <ol className={styles.workflowSteps}>
          <li><span className={styles.stepNumber}>01</span><h3><span className={styles.modeAgents}>Connect your agent</span><span className={styles.modeScheduling}>Connect your channels</span></h3><p><span className={styles.modeAgents}>Choose the workspace and accounts your MCP or API client can use.</span><span className={styles.modeScheduling}>Add the supported accounts you want to manage from your workspace.</span></p></li>
          <li><span className={styles.stepNumber}>02</span><h3>Prepare and review</h3><p>Write a draft or send one from your agent. Check the copy, media and any required approvals.</p></li>
          <li><span className={styles.stepNumber}>03</span><h3>Pick a time. Follow the result.</h3><p>Schedule the post in your workspace timezone. See what is queued, published or needs attention.</p></li>
        </ol>
      </section>

      <section className={`${styles.section} ${styles.toolsSection}`}>
        <div className={styles.centerHeading}><span className={styles.monoLabel}>THE EVERYDAY ESSENTIALS</span><h2>Less switching. More getting posts out.</h2><p>For your own accounts, a team or the clients you work with.</p></div>
        <div className={styles.toolsGrid}>
          {[
            ['01', 'A shared calendar', 'Keep drafts, queues and publishing results in view.'],
            ['02', 'Team & client approvals', 'Bring feedback into the workflow before a post goes live.'],
            ['03', 'Recurring posts', 'Set a repeat schedule for content you want to publish again.'],
            ['04', 'A reusable media library', 'Organize images and videos without hunting for the same file twice.'],
            ['05', 'Channel analytics', 'Review the metrics each connected platform makes available.'],
            ['06', 'Comments & conversations', 'Manage supported channel conversations from the inbox.'],
          ].map(([number, title, body]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{body}</p></article>)}
        </div>
      </section>

      <section className={`${styles.section} ${styles.agentSection}`} id="interfaces">
        <div className={styles.agentIntro}>
          <span className={styles.monoLabel}>MCP + REST API</span>
          <h2><span className={styles.modeAgents}>Give your agent a place to publish.</span><span className={styles.modeScheduling}>Want a hand? Connect your AI agent.</span></h2>
          <p>Use a compatible AI client to create drafts, work with media and schedule posts. Open the web app whenever you want to check the work.</p>
          <ul className={styles.checkList}><li>Limit access to selected workspaces and accounts.</li><li>Start with drafts, then allow scheduling when you are ready.</li><li>Keep required approvals in place.</li></ul>
        </div>
        <div className={styles.agentExample}>
          <span className={styles.exampleLabel}>EXAMPLE INSTRUCTION FOR YOUR AGENT</span>
          <blockquote>“Prepare three posts from this brief. Save them as drafts so I can review them before we schedule.”</blockquote>
          <div className={styles.toolTags}><span>list_accounts</span><span>create_draft</span><span>schedule_draft</span></div>
          <p>Your client connects through MCP or the API. Content generation happens in the AI tools you choose.</p>
          <a href={entryHref}>Explore agent publishing <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <section className={`${styles.section} ${styles.channelsSection}`} id="channels">
        <span className={styles.monoLabel}>YOUR SOCIAL CHANNELS</span><h2>Keep your channels together.</h2>
        <p>Prepare content for the networks your audience uses.</p>
        <div className={styles.networkNames}>{['Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'YouTube', 'Pinterest', 'Threads', 'Bluesky', 'Google Business', 'Mastodon', 'DEV.to'].map(name => <span key={name}>{name}</span>)}</div>
        <p className={styles.availabilityNote}>Channel availability depends on platform permissions, account requirements and the feature you want to use. {brand.publicPreview && 'Customer connections are not open on this preview site.'}</p>
      </section>

      <section className={`${styles.section} ${styles.betaSection}`} id="pricing">
        <div><span className={styles.monoLabel}>AVAILABILITY & PRICING</span><h2>A look at what’s coming.</h2><p>{brand.publicPreview ? 'Explore the product preview now. Customer signup is not open yet, and pricing will be published before billing begins.' : 'Open your workspace to get started. Public plans will be published before billing begins.'}</p></div>
        <Link className={styles.primaryAction} href={entryHref}>{entryLabel} <span aria-hidden="true">↗</span></Link>
      </section>

      <section className={`${styles.section} ${styles.faqSection}`} id="faq">
        <div className={styles.sectionHeadingCompact}><span className={styles.monoLabel}>GOOD QUESTIONS</span><h2>Before your first post.</h2></div>
        <div className={styles.faqList}>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
      </section>

      <section className={styles.finalCta}>
        <span className={styles.monoLabel}>YOUR POSTS. YOUR WAY.</span><h2>Make room for your next week of content.</h2>
        <p>Schedule it yourself. Let your agent help. Keep it all in PostDelegate.</p>
        <Link className={styles.limeAction} href={entryHref}>{entryLabel} <span aria-hidden="true">↗</span></Link>
      </section>
    </div>
  );
}
