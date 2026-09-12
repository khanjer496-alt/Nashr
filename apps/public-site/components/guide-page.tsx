import Link from 'next/link';
import { brand } from '@gitroom/nashr-brand/brand.config';
import { pages, directoryPages } from '../content/pages';
import { UtilityTool } from './utility-tool';
import { AgentLanding } from './agent-landing';

function LinkedText({ value }: { value: string }) {
  return <>{value.split(/(https?:\/\/[^\s<>]+)/g).map((part, index) => {
    if (!part.startsWith('https://') && !part.startsWith('http://')) return part;
    const url = part.replace(/[.,;)]$/, '');
    return <span key={index}><a className="guide-source-link" href={url}>{url}</a>{part.slice(url.length)}</span>;
  })}</>;
}

export function GuidePage({ slug }: {slug:string}) {
  if (['mcp','claude-cowork','codex'].includes(slug)) return <AgentLanding slug={slug}/>;
  const page = pages[slug]; const directory = directoryPages[slug];
  if (!page && !directory) return null;
  const info = page || directory; const isTools = slug === 'tools';
  const category = page?.tool || isTools ? ['Free tools','/tools'] : slug.includes('scheduler') || slug === 'platforms' ? ['Platforms','/platforms'] : slug.startsWith('compare') ? ['Compare','/compare'] : ['Agent guides','/agents'];
  const sections = page?.sections || [];
  const hasIntro = sections[0]?.heading === 'Before you connect';
  const start = hasIntro ? 1 : 0;
  return <article className={`public-guide ${isTools ? 'tool-directory-page' : ''}`}>
    <nav aria-label="Breadcrumb"><Link href="/">PostDelegate</Link><span aria-hidden="true"> / </span><Link href={category[1]}>{category[0]}</Link></nav>
    <header><p className="guide-eyebrow">{page?.eyebrow || (isTools ? 'FREE. PRIVATE. READY TO USE.' : 'EXPLORE POSTDELEGATE')}</p><h1>{info.title}</h1><p>{info.description}</p>
      {!directory && !page?.tool && <div className="guide-hero-actions"><a href={`#guide-section-${start}`}>Get started <span aria-hidden="true">↓</span></a><Link href="/mcp">Explore MCP</Link></div>}
      {(isTools || page?.tool) && <div className="tool-trust"><span>No account needed</span><span>Runs in your browser</span><span>No uploads</span></div>}
    </header>
    {!page?.tool && !isTools && <aside className="guide-preview">Preview · Public connections are not open yet. <Link href="/status">See launch status →</Link></aside>}
    {directory && <div className={`guide-directory ${isTools ? 'featured-tools' : ''}`}>{directory.paths.map((path,i) => <Link href={`/${path}`} key={path}>
      <div className="directory-icon" aria-hidden="true">{isTools ? (i===0 ? 'Aa' : '↗') : String(i+1).padStart(2,'0')}</div>
      {isTools && <div className="tool-card-category">{i===0 ? 'WRITING' : 'CAMPAIGNS'}</div>}
      <h2>{pages[path].title}</h2><p>{pages[path].description}</p>
      {isTools && <div className="tool-card-example" aria-hidden="true">{i===0 ? <><strong>Your next post, ready.</strong><div className="sample-meter"/><small>Check length before publishing.</small></> : <><strong>example.com/launch</strong><code>?utm_source=linkedin</code><small>Keep track of every campaign.</small></>}</div>}
      <span>{isTools ? (i===0 ? 'Check your caption' : 'Build a tracking link') : 'Open guide'} →</span></Link>)}</div>}
    {page?.tool && <div id="public-tool" data-tool-kind={page.tool}><UtilityTool kind={page.tool}/></div>}
    {!!sections.length && <div className={`guide-body ${page?.tool ? 'guide-body-tool' : ''}`}>
      {!page?.tool && <nav className="guide-toc" aria-label="On this page"><strong>ON THIS PAGE</strong>{sections.map((section,i)=><a href={`#guide-section-${i}`} key={section.heading}>{section.heading}</a>)}</nav>}
      <div className="guide-sections">{sections.map((section,i) => hasIntro && i===0 ? <details className="guide-prerequisites" key={section.heading} id={`guide-section-${i}`}><summary>Before you connect</summary><p><LinkedText value={section.body}/></p></details> : <section id={`guide-section-${i}`} key={section.heading}><span className="guide-step">{String(i-start+1).padStart(2,'0')}</span><h2>{section.heading}</h2><p><LinkedText value={section.body}/></p>{section.items && <ul>{section.items.map(item => <li key={item}><LinkedText value={item}/></li>)}</ul>}{section.code && <div className="guide-code"><div>Example · replace the placeholder values</div><pre><code>{section.code}</code></pre></div>}</section>)}</div>
    </div>}
    <section className="guide-next"><h2>{isTools ? 'Ready to plan the post?' : 'Your next step'}</h2><p>Bring your content into one workspace, whether you schedule it yourself or use an agent.</p><div><Link href="/agents">Agent guides</Link><Link href="/platforms">Platforms</Link><Link href="/tools">Free tools</Link><Link href="/compare">Compare</Link><Link href={brand.publicPreview ? '/status' : `${brand.workspaceUrl}/accounts/login/`}>{brand.publicPreview ? 'Launch status' : 'Open workspace'}</Link></div></section>
  </article>;
}
