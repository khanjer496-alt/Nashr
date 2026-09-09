#!/usr/bin/env node
/** Build-time public asset allowlist and checks. Never exports app/server data. */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { requireOrigin } from './platform-access.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const publicPages = ['/', '/about', '/terms', '/privacy', '/licenses', '/support', '/data-deletion', '/status'];
const files = ['postdelegate-mark.svg', 'postdelegate-logo.svg', 'postdelegate-logo-ar.svg', 'postdelegate-og.svg', 'favicon.svg', 'favicon.ico', 'apple-touch-icon.png'];
const platforms = ['x', 'linkedin', 'instagram', 'youtube', 'tiktok', 'threads', 'bluesky', 'reddit'];

export function checkPublicConfig(env) {
  requireOrigin(env.NEXT_PUBLIC_APP_URL);
  if (!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA || '')) throw new Error('Exact source commit is required');
  if (env.NEXT_PUBLIC_SOURCE_URL !== `https://github.com/khanjer496-alt/Nashr/tree/${env.GITHUB_SHA}`) throw new Error('Source offer must match this build');
}

export function prepare(env = process.env) {
  checkPublicConfig(env);
  const target = resolve(root, 'apps/public-site/public');
  for (const file of [...files, ...platforms.map((p) => `icons/platforms/${p}.png`)]) {
    const destination = resolve(target, file);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(resolve(root, 'apps/frontend/public', file), destination);
  }
  // No auth/API redirect to the home page, and no SPA fallback disguising 404s.
  writeFileSync(resolve(target, '_redirects'), '/auth /status 302\n/auth/* /status 302\n');
  writeFileSync(resolve(target, '_headers'), `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'
`);
  writeFileSync(resolve(target, 'robots.txt'), 'User-agent: *\nDisallow: /auth\nDisallow: /api\n');
  writeFileSync(resolve(target, 'deployment.json'), JSON.stringify({
    product: 'PostDelegate', scope: 'public-preview-only', sourceCommit: env.GITHUB_SHA,
    sourceUrl: env.NEXT_PUBLIC_SOURCE_URL, customerSignup: false, publishingBackend: false,
    platformApprovals: 'not verified',
  }, null, 2) + '\n');
}

const plain = (html) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
export function inspectPage(path, html, sha) {
  const errors = [];
  const text = plain(html);
  if (!text.includes('PostDelegate')) errors.push('Product identity missing');
  if (/<form\b/i.test(html) || /href=["']\/auth(?:[/?"'])/i.test(html)) errors.push('Preview contains account entry points');
  if (/mailto:["']|mailto:[^"']*@[^"']*\.pages\.dev/i.test(html)) errors.push('Unconfigured or invented mailbox');
  if (path === '/' && !text.includes('Customer signup and publishing are not open yet')) errors.push('Preview disclosure missing');
  if (path === '/status' && !text.includes('No social-platform approval is claimed')) errors.push('Platform approval disclosure missing');
  if (path === '/licenses' && !html.includes(`https://github.com/khanjer496-alt/Nashr/tree/${sha}`)) errors.push('Exact source offer missing');
  if (path === '/support' && !/<h1[^>]*>Support<\/h1>/.test(html)) errors.push('Support heading missing');
  if (path === '/data-deletion' && !/<h1[^>]*>Data deletion<\/h1>/.test(html)) errors.push('Deletion heading missing');
  return errors;
}

export function verify(directory = resolve(root, 'apps/public-site/out'), env = process.env) {
  checkPublicConfig(env);
  const checks = publicPages.map((path) => {
    const file = resolve(directory, path === '/' ? 'index.html' : `${path.slice(1)}.html`);
    return { path, errors: existsSync(file) ? inspectPage(path, readFileSync(file, 'utf8'), env.GITHUB_SHA) : ['Exported page missing'] };
  });
  for (const file of ['404.html', '_headers', '_redirects', 'deployment.json', ...files]) {
    checks.push({ path: file, errors: existsSync(resolve(directory, file)) ? [] : ['Required public asset missing'] });
  }
  for (const path of ['api', 'api.html', 'auth.html', '.env', 'uploads', '.next/server']) {
    checks.push({ path, errors: existsSync(resolve(directory, path)) ? ['Private/runtime path must not be exported'] : [] });
  }
  return { ok: checks.every((c) => c.errors.length === 0), scope: 'public-preview-only', checks, notice: 'Not a full-app readiness check; policy drafts, backend and social approvals remain separate gates.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv[2] === 'prepare') prepare();
    else if (process.argv[2] === 'verify') {
      const report = verify();
      console.log(JSON.stringify(report, null, 2));
      if (!report.ok) process.exitCode = 1;
    } else throw new Error('Usage: public-site.mjs prepare|verify');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
