/** Exercise the actual provider classes with isolated, deterministic API doubles.
 * The normal monorepo build separately type-checks the production imports.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = resolve(__dirname, '../..');

function load(file, fetch, overrides = {}) {
  const source = readFileSync(resolve(root, 'libraries/nestjs-libraries/src/integrations/social', `${file}.provider.ts`), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, esModuleInterop: true } }).outputText;
  class Base {
    checkScopes(required, granted) {
      const values = Array.isArray(granted) ? granted : String(granted).split(/[ ,]+/);
      if (required.some((scope) => !values.includes(scope))) throw new Error('Missing scope');
    }
  }
  class BadBody extends Error { constructor(_id, _json, _body, message) { super(message); } }
  const module = { exports: {} };
  const env = { FRONTEND_URL: 'https://app.test.invalid', LINKEDIN_CLIENT_ID: 'client', LINKEDIN_CLIENT_SECRET: 'secret', YOUTUBE_CLIENT_ID: 'client', YOUTUBE_CLIENT_SECRET: 'secret' };
  const requireMock = (name) => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name.endsWith('/social.abstract')) return { SocialAbstract: Base, BadBody, RefreshToken: Error };
    if (name.endsWith('/make.is')) return { makeId: (n) => 'a'.repeat(n) };
    if (name.endsWith('/post.plug')) return { PostPlug: () => () => {} };
    if (name.endsWith('/plug.decorator')) return { Plug: () => () => {} };
    if (name.endsWith('/rules.description.decorator')) return { Rules: () => () => {} };
    if (name === 'node:process') return { env };
    if (name.startsWith('node:') || name === 'fs' || name === 'stream') return require(name);
    return {};
  };
  vm.runInNewContext(output, { module, exports: module.exports, require: requireMock, fetch, process: { env }, URL, URLSearchParams, Buffer, console });
  return module.exports;
}

for (const page of [false, true]) {
  test(`LinkedIn ${page ? 'Page' : 'member'} authenticates and refreshes using OIDC, not legacy profile access`, async () => {
    const calls = [];
    let instance;
    const fetch = async (url) => {
      calls.push(String(url));
      if (String(url).endsWith('/accessToken')) return { json: async () => ({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, scope: instance.scopes.join(' ') }) };
      if (String(url).endsWith('/userinfo')) return { json: async () => ({ sub: 'member-id', name: 'Reviewer', picture: 'picture' }) };
      throw new Error('Unexpected endpoint');
    };
    const { LinkedinProvider } = load('linkedin', fetch);
    const Provider = page ? load('linkedin.page', fetch, { '@gitroom/nestjs-libraries/integrations/social/linkedin.provider': { LinkedinProvider } }).LinkedinPageProvider : LinkedinProvider;
    instance = new Provider();
    const auth = await instance.generateAuthUrl();
    const url = new URL(auth.url);
    assert.equal(url.searchParams.has('prompt'), false);
    assert.equal(url.searchParams.get('redirect_uri'), `https://app.test.invalid/integrations/social/linkedin${page ? '-page' : ''}`);
    assert.equal(url.searchParams.get('scope'), instance.scopes.join(' '));
    for (const result of [await instance.authenticate({ code: 'code', codeVerifier: 'verifier' }), await instance.refreshToken('refresh')]) {
      assert.equal(result.id, 'member-id');
      assert.equal(result.name, 'Reviewer');
      assert.equal(result.username, '');
    }
    assert.equal(calls.length, 4);
    assert.ok(calls.every((url) => !url.endsWith('/me')));
  });
}

test('member connection does not send requests to organization lookup endpoints', async () => {
  let calls = 0;
  const { LinkedinProvider } = load('linkedin', async () => { calls++; throw new Error('Unexpected request'); });
  const provider = new LinkedinProvider();
  assert.equal((await provider.mention('token', { query: 'company' })).length, 0);
  await assert.rejects(provider.company('token', { url: 'https://www.linkedin.com/company/example/' }), /requires a LinkedIn Page/);
  assert.equal(calls, 0);
});

test('Page connection retains organization lookup after member-scope reduction', async () => {
  const fetch = async () => ({ json: async () => ({ elements: [{ id: 1, localizedName: 'Company' }] }) });
  const { LinkedinProvider } = load('linkedin', fetch);
  const { LinkedinPageProvider } = load('linkedin.page', fetch, { '@gitroom/nestjs-libraries/integrations/social/linkedin.provider': { LinkedinProvider } });
  const provider = new LinkedinPageProvider();
  assert.equal((await provider.mention('token', { query: 'company' }))[0].label, 'Company');
  assert.ok(!provider.scopes.includes('w_member_social'));
});

test('YouTube consent URL carries only the four permissions used by implemented features', async () => {
  let request;
  const google = { auth: { OAuth2: class { generateAuthUrl(options) { request = options; return 'https://accounts.google.com/o/oauth2/v2/auth'; } } } };
  const { YoutubeProvider } = load('youtube', async () => { throw new Error('No HTTP expected'); }, { googleapis: { google } });
  const provider = new YoutubeProvider();
  await provider.generateAuthUrl();
  assert.deepEqual(Array.from(request.scope), ['userinfo.profile', 'youtube.readonly', 'youtube.upload', 'yt-analytics.readonly'].map((scope) => `https://www.googleapis.com/auth/${scope}`));
  assert.equal(request.access_type, 'offline');
  assert.equal(request.prompt, 'consent');
});
