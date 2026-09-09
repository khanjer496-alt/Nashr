#!/usr/bin/env node
/** Read-only launch helpers. No credentials are printed and no app is submitted. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const repository = 'khanjer496-alt/Nashr';
const sourceDirectory = 'libraries/nestjs-libraries/src/integrations/social';

export const providers = [
  ['facebook', 'facebook', 'FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
  ['instagram', 'instagram', 'FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
  ['instagram-standalone', 'instagram.standalone', 'INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET'],
  ['threads', 'threads', 'THREADS_APP_ID', 'THREADS_APP_SECRET'],
  ['tiktok', 'tiktok', 'TIKTOK_CLIENT_ID', 'TIKTOK_CLIENT_SECRET'],
  ['linkedin', 'linkedin', 'LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
  ['linkedin-page', 'linkedin.page', 'LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
  ['youtube', 'youtube', 'YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'],
  ['x', 'x', 'X_API_KEY', 'X_API_SECRET'],
  ['pinterest', 'pinterest', 'PINTEREST_CLIENT_ID', 'PINTEREST_CLIENT_SECRET'],
];

/** Fail closed if a provider stops declaring a static list; never execute it. */
export function extractScopes(source) {
  const body = source.match(/\bscopes\s*=\s*\[([\s\S]*?)\]/)?.[1];
  if (body === undefined) throw new Error('Static provider scope list not found');
  const uncommented = body
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const literal = /'([^'\n]*)'|"([^"\n]*)"/g;
  const scopes = [...uncommented.matchAll(literal)].map((match) => match[1] ?? match[2]);
  if (uncommented.replace(literal, '').replace(/[\s,]/g, '')) {
    throw new Error('Dynamic provider scopes require a manual review');
  }
  return scopes;
}

/** Validate configuration shape, not domain ownership or DNS/TLS availability. */
export function requireOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('A real HTTPS origin is required'); }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== 'https:' || url.username || url.password || url.port ||
    url.pathname !== '/' || url.search || url.hash ||
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(host) ||
    /(?:^|\.)(?:localhost|example\.com|example\.org|example\.net)$/.test(host) ||
    /\.(?:example|invalid|test|local|localhost)$/.test(host)
  ) throw new Error('Use an owned HTTPS hostname without a path, credentials, port or placeholder');
  return url.origin;
}

export function manifest(origin, read = (path) => readFileSync(resolve(root, path), 'utf8')) {
  const base = origin ? requireOrigin(origin) : '<FRONTEND_URL>';
  return {
    product: 'PostDelegate',
    notice: 'Source inventory only. Credentials, permissions, submission and approval are NOT verified.',
    providers: providers.map(([id, file, clientId, secret]) => {
      const source = `${sourceDirectory}/${file}.provider.ts`;
      const content = read(source);
      // Catch stale credential mappings as well as changed scopes.
      for (const key of [clientId, secret]) {
        if (!content.includes(`process.env.${key}`)) {
          throw new Error(`Credential mapping requires review: ${id}`);
        }
      }
      return {
        id, source,
        callback: `${base}/integrations/social/${id}`,
        credentialNames: [clientId, secret],
        auth: id === 'x' ? 'OAuth 1.0a user context; app Read and Write permission' : 'OAuth 2.0',
        scopes: extractScopes(content),
        submission: 'not verified',
        approval: 'not verified',
      };
    }),
  };
}

const placeholder = /placeholder|change[_ -]?me|not configured|to be confirmed|your (?:company|entity)/i;

export function checkBuild(env) {
  const errors = [];
  let origin;
  try { origin = requireOrigin(env.NEXT_PUBLIC_APP_URL); }
  catch { errors.push('NEXT_PUBLIC_APP_URL: real HTTPS origin required'); }
  if (!origin || env.NEXT_PUBLIC_BACKEND_URL !== `${origin}/api`) {
    errors.push('NEXT_PUBLIC_BACKEND_URL: must equal the app origin plus /api');
  }
  for (const key of ['NEXT_PUBLIC_BRAND_LEGAL_NAME', 'NEXT_PUBLIC_BRAND_JURISDICTION', 'NEXT_PUBLIC_BRAND_GOVERNING_LAW']) {
    if (!env[key]?.trim() || placeholder.test(env[key])) errors.push(`${key}: operator decision required`);
  }
  for (const key of ['NEXT_PUBLIC_SUPPORT_EMAIL', 'NEXT_PUBLIC_PRIVACY_EMAIL']) {
    const value = env[key] || '';
    const parts = value.split('@');
    try {
      if (parts.length !== 2 || !/^[^\s<>]+$/.test(parts[0])) throw new Error();
      requireOrigin(`https://${parts[1]}`);
    } catch { errors.push(`${key}: monitored address on a real domain required`); }
  }
  if (env.STORAGE_PROVIDER !== 'cloudflare') errors.push('STORAGE_PROVIDER: approved production topology uses cloudflare');
  const source = env.NEXT_PUBLIC_SOURCE_URL || '';
  const expected = `https://github.com/${repository}/tree/`;
  const revision = source.startsWith(expected) ? source.slice(expected.length) : '';
  if (!/^[a-f0-9]{40}$/.test(revision)) {
    errors.push('NEXT_PUBLIC_SOURCE_URL: exact public PostDelegate commit URL required');
  } else if (env.GITHUB_SHA && revision !== env.GITHUB_SHA) {
    errors.push('NEXT_PUBLIC_SOURCE_URL: must match the commit being built');
  }
  return {
    ok: errors.length === 0, errors,
    notice: 'Public build configuration only; not proof of legal approval, domain ownership, runtime safety or platform access.',
  };
}

const publicChecks = [
  ['/', 'PostDelegate'],
  ['/terms', 'Terms of Service'],
  ['/privacy', 'Privacy Policy'],
  ['/licenses', 'source'],
  ['/support', 'Support'],
  ['/data-deletion', 'Data deletion'],
  ['/api/', 'App is running!'],
];

/** GET only, no cookies or credentials, and never follow login redirects. */
export async function smoke(origin, fetchImpl = fetch) {
  const base = requireOrigin(origin);
  const checks = [];
  for (const [path, marker] of publicChecks) {
    const errors = [];
    let status = null;
    try {
      const response = await fetchImpl(`${base}${path}`, {
        method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'PostDelegate-launch-check/1.0' },
      });
      status = response.status;
      if (status !== 200) errors.push('Expected unauthenticated HTTP 200 without redirect');
      const body = await response.text();
      const text = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
      if (!text.toLowerCase().includes(marker.toLowerCase())) errors.push('Expected page content missing');
      if (['/terms', '/privacy', '/support', '/data-deletion'].includes(path)) {
        const headings = [...body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
          .map((match) => match[1].replace(/<[^>]*>/g, '').trim().toLowerCase());
        if (!headings.includes(marker.toLowerCase())) errors.push('Expected page heading missing');
      }
      if (path !== '/api/' && !response.headers.get('content-type')?.includes('text/html')) {
        errors.push('Expected an HTML page');
      }
      if (path !== '/api/' && /placeholder|draft skeleton|not configured|to be confirmed|\.example\b/i.test(text)) {
        errors.push('Unfinished or placeholder public copy detected');
      }
      if (path === '/licenses' && !/https:\/\/github\.com\/khanjer496-alt\/Nashr\/tree\/[a-f0-9]{40}/.test(body)) {
        errors.push('Exact deployed-source offer missing');
      }
    } catch {
      // Do not include response bodies or exception strings in a report.
      errors.push('Request failed or timed out');
    }
    checks.push({ path, status, ok: errors.length === 0, errors });
  }
  return {
    ok: checks.every((check) => check.ok), checks,
    notice: 'Read-only public smoke test; OAuth, real publishing, deletion handling and backup restore need separate evidence.',
  };
}

async function main(args) {
  const [command, origin] = args;
  let report;
  if (command === 'manifest' && args.length <= 2) report = manifest(origin);
  else if (command === 'check-build' && args.length === 1) report = checkBuild(process.env);
  else if (command === 'smoke' && args.length === 2) report = await smoke(origin);
  else throw new Error('Usage: node ops/scripts/platform-access.mjs manifest [HTTPS_ORIGIN] | check-build | smoke HTTPS_ORIGIN');
  console.log(JSON.stringify(report, null, 2));
  if (report.ok === false) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
