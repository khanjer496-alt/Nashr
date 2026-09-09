import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPublicConfig, inspectPage } from '../../ops/scripts/public-site.mjs';

const sha = 'a'.repeat(40);
const env = { GITHUB_SHA: sha, NEXT_PUBLIC_APP_URL: 'https://postdelegate.pages.dev', NEXT_PUBLIC_SOURCE_URL: `https://github.com/khanjer496-alt/Nashr/tree/${sha}` };
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
