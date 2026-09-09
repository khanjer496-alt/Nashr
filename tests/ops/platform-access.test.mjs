import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkBuild, extractScopes, manifest, requireOrigin, smoke } from '../../ops/scripts/platform-access.mjs';

const revision = 'a'.repeat(40);
const config = () => ({
  NEXT_PUBLIC_APP_URL: 'https://app.postdelegate.com',
  NEXT_PUBLIC_BACKEND_URL: 'https://app.postdelegate.com/api',
  NEXT_PUBLIC_BRAND_LEGAL_NAME: 'Test Operator',
  NEXT_PUBLIC_BRAND_JURISDICTION: 'Test Jurisdiction',
  NEXT_PUBLIC_BRAND_GOVERNING_LAW: 'Operator-reviewed terms',
  NEXT_PUBLIC_SUPPORT_EMAIL: 'support@postdelegate.com',
  NEXT_PUBLIC_PRIVACY_EMAIL: 'privacy@postdelegate.com',
  NEXT_PUBLIC_SOURCE_URL: `https://github.com/khanjer496-alt/Nashr/tree/${revision}`,
  GITHUB_SHA: revision,
  STORAGE_PROVIDER: 'cloudflare',
});
// The hostname above is a test fixture, not a registration/ownership claim.
test('scope parsing ignores commented permissions but preserves URL scopes', () => {
  assert.deepEqual(extractScopes("scopes = ['one',\n // 'not_requested',\n 'https://scope.test/read',];"), ['one', 'https://scope.test/read']);
});
test('dynamic or absent scopes require manual review', () => {
  assert.throws(() => extractScopes('scopes = [readScope, ...otherScopes]'));
  assert.throws(() => extractScopes('const other = []'));
  assert.deepEqual(extractScopes('scopes = [] as string[];'), []);
});
test('origin validation rejects placeholders and callback mistakes', () => {
  for (const value of ['http://app.postdelegate.com', 'https://postdelegate.example', 'https://example.com', 'https://app.example.com', 'https://localhost', 'https://127.0.0.1', 'https://192.168.1.10', 'https://app.postdelegate.com/path', 'https://x:y@app.postdelegate.com', 'https://app.postdelegate.com?x=1', 'https://app.postdelegate.com:8443']) {
    assert.throws(() => requireOrigin(value), value);
  }
  assert.equal(requireOrigin('https://app.postdelegate.com/'), 'https://app.postdelegate.com');
});
test('manifest reads all ten provider scope declarations without executing them', () => {
  const result = manifest();
  assert.equal(result.providers.length, 10);
  assert.ok(result.providers.every((provider) => provider.approval === 'not verified'));
  assert.ok(result.providers.every((provider) => provider.callback.startsWith('<FRONTEND_URL>/integrations/social/')));
});
test('Instagram Facebook and standalone credentials are not confused', () => {
  const result = manifest().providers;
  assert.deepEqual(result.find((p) => p.id === 'instagram').credentialNames, ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET']);
  assert.deepEqual(result.find((p) => p.id === 'instagram-standalone').credentialNames, ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET']);
});
test('personal publishing does not request organization or YouTube partner access', () => {
  const result = manifest().providers;
  assert.deepEqual(result.find((p) => p.id === 'linkedin').scopes, ['openid', 'profile', 'w_member_social']);
  assert.deepEqual(result.find((p) => p.id === 'linkedin-page').scopes, ['openid', 'profile', 'rw_organization_admin', 'w_organization_social', 'r_organization_social']);
  assert.deepEqual(result.find((p) => p.id === 'youtube').scopes, [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
  ]);
  assert.ok(!result.find((p) => p.id === 'threads').scopes.includes('threads_profile_discovery'));
  assert.equal(result.find((p) => p.id === 'x').auth.startsWith('OAuth 1.0a'), true);
});
test('callback manifest uses exactly the supplied origin', () => {
  const result = manifest('https://app.postdelegate.com');
  assert.equal(result.providers[0].callback, 'https://app.postdelegate.com/integrations/social/facebook');
  assert.equal(JSON.stringify(result).includes('redirectmeto.com'), false);
});
test('configuration guard accepts a consistent public build configuration', () => {
  assert.equal(checkBuild(config()).ok, true);
});
test('configuration guard blocks missing decisions without printing their values', () => {
  const env = config();
  env.NEXT_PUBLIC_BRAND_LEGAL_NAME = 'placeholder-sensitive-value';
  env.NEXT_PUBLIC_SUPPORT_EMAIL = 'bad-sensitive-value';
  const report = checkBuild(env);
  assert.equal(report.ok, false);
  assert.equal(JSON.stringify(report).includes('sensitive-value'), false);
});
test('configuration guard rejects wrong backend, storage and floating source', () => {
  const env = config();
  env.NEXT_PUBLIC_BACKEND_URL = 'https://another.postdelegate.com/api';
  env.NEXT_PUBLIC_SOURCE_URL = 'https://github.com/gitroomhq/postiz-app';
  env.STORAGE_PROVIDER = 'local';
  assert.equal(checkBuild(env).errors.length, 3);
});
test('configuration guard requires the source offer to match the built commit', () => {
  assert.equal(checkBuild({ ...config(), GITHUB_SHA: 'b'.repeat(40) }).ok, false);
});
const fakeFetch = async (url, options) => {
  assert.equal(options.redirect, 'manual');
  assert.equal(options.method, 'GET');
  assert.equal(options.headers.Authorization, undefined);
  const path = new URL(url).pathname;
  const headings = { '/': 'PostDelegate', '/terms': 'Terms of Service', '/privacy': 'Privacy Policy', '/licenses': 'Licences and source', '/support': 'Support', '/data-deletion': 'Data deletion' };
  return new Response(path === '/api/' ? 'App is running!' : `<h1>${headings[path]}</h1><a href="https://github.com/khanjer496-alt/Nashr/tree/${revision}">Source</a>`, { status: 200, headers: { 'content-type': path === '/api/' ? 'text/plain' : 'text/html' } });
};
test('smoke checks all review pages and API without authenticated access', async () => {
  const result = await smoke('https://app.postdelegate.com', fakeFetch);
  assert.equal(result.ok, true);
  assert.equal(result.checks.length, 7);
});
test('login redirects do not count as successful review pages', async () => {
  const result = await smoke('https://app.postdelegate.com', async () => new Response('', { status: 307, headers: { location: '/auth' } }));
  assert.equal(result.ok, false);
  assert.ok(result.checks.every((check) => check.status === 307 && !check.ok));
});
test('HTTP 200 does not hide legal placeholders or missing content', async () => {
  const result = await smoke('https://app.postdelegate.com', async () => new Response('<h1>Placeholder — requires legal review</h1>', { headers: { 'content-type': 'text/html' } }));
  assert.equal(result.ok, false);
  assert.ok(result.checks[0].errors.includes('Unfinished or placeholder public copy detected'));
});
test('a login page containing legal/footer links does not pass as a review page', async () => {
  const result = await smoke('https://app.postdelegate.com', async () => new Response('<h1>Sign in</h1><footer>Terms of Service Privacy Policy Support Data deletion</footer>', { headers: { 'content-type': 'text/html' } }));
  for (const path of ['/terms', '/privacy', '/support', '/data-deletion']) {
    assert.ok(result.checks.find((check) => check.path === path).errors.includes('Expected page heading missing'));
  }
});
test('a failed network check never logs exception data', async () => {
  const result = await smoke('https://app.postdelegate.com', async () => { throw new Error('sensitive-response-detail'); });
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(result).includes('sensitive-response-detail'), false);
});
test('new review routes are public and use central contact configuration', () => {
  const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
  const proxy = read('apps/frontend/src/proxy.ts');
  for (const route of ['support', 'data-deletion']) {
    assert.ok(proxy.includes(`'/${route}'`));
    const page = read(`apps/frontend/src/app/(app)/(site)/${route}/page.tsx`);
    assert.ok(page.includes('brand.'));
    assert.equal(/https:\/\/app\.postdelegate\.com/.test(page), false);
  }
});
