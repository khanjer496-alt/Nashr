import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPublicConfig, inspectPage } from '../../ops/scripts/public-site.mjs';

const sha = 'a'.repeat(40);
const env = { GITHUB_SHA: sha, NEXT_PUBLIC_APP_URL: 'https://postdelegate.com', NEXT_PUBLIC_SOURCE_URL: `https://github.com/khanjer496-alt/Nashr/tree/${sha}` };
test('public preview requires an exact corresponding source version', () => {
  assert.doesNotThrow(() => checkPublicConfig(env));
  assert.throws(() => checkPublicConfig({ ...env, GITHUB_SHA: 'main' }));
  assert.throws(() => checkPublicConfig({ ...env, NEXT_PUBLIC_SOURCE_URL: 'https://github.com/khanjer496-alt/Nashr' }));
});
test('preview does not disguise signup or invent mailbox addresses', () => {
  for (const html of ['<form></form>', '<a href="/auth">Start</a>', '<a href="mailto:">Email</a>', '<a href="mailto:support@postdelegate.pages.dev">Email</a>']) {
    assert.ok(inspectPage('/about', `PostDelegate ${html}`, sha).length);
  }
});
test('live-state language is checked against rendered content, not script payloads', () => {
  assert.ok(inspectPage('/', 'PostDelegate<script>Customer signup and publishing are not open yet</script>', sha).length);
  assert.deepEqual(inspectPage('/', 'PostDelegate Customer signup and publishing are not open yet', sha), []);
});
test('deletion and support pages must exist with real headings', () => {
  assert.ok(inspectPage('/support', 'PostDelegate footer Support', sha).length);
  assert.deepEqual(inspectPage('/data-deletion', 'PostDelegate<h1>Data deletion</h1>', sha), []);
});
test('the custom-domain build cannot retain pages.dev sharing metadata', () => {
  const body = 'PostDelegate Customer signup and publishing are not open yet';
  const good = '<meta property="og:url" content="https://postdelegate.com"/><link rel="canonical" href="https://postdelegate.com/"/>';
  assert.deepEqual(inspectPage('/', body + good, sha, env.NEXT_PUBLIC_APP_URL), []);
  assert.ok(inspectPage('/', body + good.replaceAll('postdelegate.com', 'postdelegate.pages.dev'), sha, env.NEXT_PUBLIC_APP_URL).includes('Open Graph URL does not match the public origin'));
  assert.ok(inspectPage('/', body, sha, env.NEXT_PUBLIC_APP_URL).includes('Homepage canonical does not match the public origin'));
});
test('subpages do not require a misleading homepage canonical', () => {
  assert.deepEqual(inspectPage('/about', 'PostDelegate<meta property="og:url" content="https://postdelegate.com"/>', sha, env.NEXT_PUBLIC_APP_URL), []);
});
