import React from 'react';
import Link from 'next/link';
import { brand } from '@gitroom/nashr-brand/brand.config';

const groups = [
  ['For AI agents', [['Agent guides','/agents'],['MCP server','/mcp'],['REST API','/api'],['Claude Cowork','/claude-cowork'],['Codex','/codex']]],
  ['Platforms', [['Instagram','/instagram-scheduler'],['LinkedIn','/linkedin-scheduler'],['Facebook','/facebook-scheduler'],['TikTok','/tiktok-scheduler'],['YouTube','/youtube-scheduler'],['Bluesky','/bluesky-scheduler'],['All platforms','/platforms']]],
  ['Tools & comparisons', [['Free tools','/tools'],['Caption checker','/tools/caption-checker'],['UTM link builder','/tools/utm-builder'],['Compare products','/compare'],['PostDelegate vs Postiz','/compare/postiz'],['PostDelegate vs Post Bridge','/compare/post-bridge']]],
  ['Company', [['About','/about'],['Launch status','/status'],['Pricing','/#pricing'],['Support','/support'],['Terms','/terms'],['Privacy','/privacy'],['Data deletion','/data-deletion'],['Licences & source','/licenses']]],
] as const;

/** Public navigation; inherited website attribution and source notices live on /licenses. */
export const BrandFooter = () => <footer className="resource-footer">
  <div className="resource-footer-grid">
    <div><h2>{brand.name}</h2><p>Social media scheduling for people and AI agents. Create drafts, review content and plan your next post.</p><p>Public product preview.</p></div>
    {groups.map(([title, links]) => <nav key={title} aria-label={title}><h3>{title}</h3>{links.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</nav>)}
  </div>
  <div className="resource-footer-bottom"><span>© {new Date().getFullYear()} {brand.legalName}</span><a href="https://github.com/khanjer496-alt/brightbean-studio">Workspace source</a><a href="https://github.com/brightbeanxyz/brightbean-studio">Workspace built on BrightBean</a><a href={brand.sourceUrl}>Website source</a></div>
</footer>;
export default BrandFooter;
