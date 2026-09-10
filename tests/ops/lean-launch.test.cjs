/** Actual source methods, isolated external dependencies. Full TypeScript and
 * database tests run separately in CI; these tests never call social/AI APIs. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const capabilityFile = 'libraries/helpers/src/configuration/launch.capabilities.ts';
const policyFile = 'libraries/nestjs-libraries/src/services/launch.policy.ts';

function harness(env = { POSTDELEGATE_LAUNCH_MODE: 'lean' }, overrides = {}) {
  let externalCalls = 0;
  const cache = new Map();
  const forbid = () => { externalCalls++; throw new Error('Unexpected external operation'); };
  let chain;
  chain = new Proxy(function () { return chain; }, {
    get(_target, key) {
      if (key === '__esModule') return false;
      if (key === 'then') return undefined;
      if (key === Symbol.iterator) return function* () {};
      return chain;
    },
  });
  class ForbiddenException extends Error {
    constructor(response) { super(response.message); this.response = response; }
    getStatus() { return 403; }
  }
  const nest = {
    Injectable: () => (target) => target, Controller: () => (target) => target,
    UseGuards: (...guards) => (target) => { target.testGuards = guards; },
    Get: () => () => {}, Post: () => () => {},
    ForbiddenException, NotFoundException: class extends Error {},
    ServiceUnavailableException: class extends Error {},
    Inject: () => () => {}, forwardRef: (fn) => fn,
  };
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative);
    const file = path.join(root, relative);
    const source = fs.readFileSync(file, 'utf8');
    const result = ts.transpileModule(source, { fileName: relative, reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        experimentalDecorators: true, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } });
    assert.deepEqual((result.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error).map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')), [], relative);
    const module = { exports: {} };
    const req = (name) => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name === '@gitroom/helpers/configuration/launch.capabilities') return load(capabilityFile);
      if (name === '@gitroom/nestjs-libraries/services/launch.policy') return load(policyFile);
      if (name === '@nestjs/common') return new Proxy(nest, { get: (obj, key) => obj[key] || chain });
      if (name === 'reflect-metadata') return {};
      if (name === 'node:process') return { env };
      if (name.startsWith('node:')) return require(name);
      if (name === 'openai') return class { images = { generate: forbid }; chat = { completions: { create: forbid, parse: forbid } }; };
      return chain;
    };
    const reflect = Object.create(Reflect);
    reflect.getMetadata = () => [];
    vm.runInNewContext(result.outputText, {
      module, exports: module.exports, require: req, process: { env },
      URL, URLSearchParams, Buffer, console, Reflect: reflect,
      fetch: forbid, setTimeout, clearTimeout,
    }, { filename: relative });
    cache.set(relative, module.exports);
    return module.exports;
  }
  return { load, externalCalls: () => externalCalls };
}

test('lean mode disables all optional spend even when credentials are present', () => {
  const h = harness();
  const { getLaunchCapabilities } = h.load(capabilityFile);
  const result = getLaunchCapabilities({ POSTDELEGATE_LAUNCH_MODE: 'lean', OPENAI_API_KEY: 'present', NEXT_PUBLIC_POLOTNO: 'present' });
  assert.equal(result.lean, true);
  for (const flag of ['hostedAi','customAgents','designer','platformAnalytics']) assert.equal(result[flag], false);
});
test('standard deployments retain behavior, but unlicensed designer remains off', () => {
  const { getLaunchCapabilities } = harness().load(capabilityFile);
  assert.equal(getLaunchCapabilities({}).hostedAi, true);
  assert.equal(getLaunchCapabilities({}).designer, false);
  assert.equal(getLaunchCapabilities({ NEXT_PUBLIC_POLOTNO: 'license' }).designer, true);
  assert.throws(() => getLaunchCapabilities({ POSTDELEGATE_LAUNCH_MODE: 'typo' }), /standard or lean/);
});
test('lean provider list defaults empty, rejects wildcard and X, preserves standard defaults', () => {
  const { isProviderEnabled } = harness().load(capabilityFile);
  assert.equal(isProviderEnabled('linkedin', {}), true);
  assert.equal(isProviderEnabled('linkedin', { POSTDELEGATE_LAUNCH_MODE: 'lean' }), false);
  const env = { POSTDELEGATE_LAUNCH_MODE: 'lean', POSTDELEGATE_ENABLED_PROVIDERS: 'linkedin,facebook' };
  assert.equal(isProviderEnabled('linkedin', env), true);
  assert.equal(isProviderEnabled('youtube', env), false);
  for (const value of ['*','linkedin;x','linkedin,x']) assert.throws(() => isProviderEnabled('linkedin', { ...env, POSTDELEGATE_ENABLED_PROVIDERS: value }));
});
test('external MCP tools stay separate from paid and newly introduced tools', () => {
  const { isLaunchToolEnabled } = harness().load(capabilityFile);
  for (const tool of ['integrationList','groupList','integrationSchema','integrationSchedulePostTool','uploadFromUrlTool']) assert.equal(isLaunchToolEnabled(tool), true);
  for (const tool of ['triggerTool','generateImageTool','generateVideoTool','generateVideoOptions','videoFunctionTool','newUnreviewedTool']) assert.equal(isLaunchToolEnabled(tool), false);
});

test('Nest gates return explicit 403 responses rather than allowing hidden routes', () => {
  const p = harness().load(policyFile);
  for (const Guard of [p.HostedAiGuard, p.CustomAgentsGuard]) {
    assert.throws(() => new Guard().canActivate(), (error) => error.getStatus() === 403 && error.response.code === 'FEATURE_DISABLED');
  }
  assert.throws(() => p.assertLaunchProvider('linkedin'), (error) => error.response.code === 'CHANNEL_DISABLED');
});

const protectedMethods = [
  ['libraries/nestjs-libraries/src/openai/openai.service.ts','OpenaiService',
    ['generateImage','generatePromptForPicture','generateVoiceFromText','generatePosts','extractWebsiteText','separatePosts','generateSlidesFromText']],
  ['libraries/nestjs-libraries/src/openai/fal.service.ts','FalService',['generateImageFromText']],
  ['libraries/nestjs-libraries/src/videos/video.manager.ts','VideoManager',['getVideoByName']],
  ['libraries/nestjs-libraries/src/3rdparties/thirdparty.manager.ts','ThirdPartyManager',['getThirdPartyByName','getIntegrationById','saveIntegration']],
  ['libraries/nestjs-libraries/src/agent/agent.graph.service.ts','AgentGraphService',['start','startCall','findCategories','findTopic','generateHook','generateContent','generatePictures']],
  ['libraries/nestjs-libraries/src/agent/agent.graph.insert.service.ts','AgentGraphInsertService',['findCategory','findTopic','findHook','newPost']],
  ['libraries/nestjs-libraries/src/database/prisma/autopost/autopost.service.ts','AutopostService',['createAutopost','startAutopost','generateDescription','generatePicture']],
  ['libraries/nestjs-libraries/src/database/prisma/integrations/integration.service.ts','IntegrationService',['checkAnalytics']],
  ['libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts','PostsService',['checkPostAnalytics']],
  ['libraries/nashr-agents/src/nashr-agents.service.ts','OpenAiModelPort',['generate']],
  ['libraries/nashr-agents/src/nashr-agents.service.ts','NashrAgentsService',['mastra']],
];
for (const [file, className, methods] of protectedMethods) {
  for (const method of methods) test(`${className}.${method} refuses lean calls BEFORE network or database work`, async () => {
    const h = harness();
    const Class = h.load(file)[className];
    assert.equal(typeof Class, 'function', className);
    const instance = Object.create(Class.prototype);
    await assert.rejects(async () => instance[method]({}, {}, {}), (error) => error.getStatus?.() === 403 && error.response.code === 'FEATURE_DISABLED');
    assert.equal(h.externalCalls(), 0);
  });
}

test('provider registry filters direct users too, not only the picker UI', () => {
  const ids = ['x','linkedin','linkedin-page','reddit','instagram','instagram-standalone','facebook','threads','youtube','gmb','tiktok','pinterest','dribbble','discord','slack','kick','twitch','mastodon','bluesky','lemmy','farcaster','telegram','nostr','vk','medium','dev.to','hashnode','wordpress','listmonk','moltbook','whop','skool','mewe','tumblr'];
  let nextId = 0;
  const provider = new Proxy({}, { get() { return class { identifier = ids[nextId++]; }; } });
  const file = 'libraries/nestjs-libraries/src/integrations/integration.manager.ts';
  const source = fs.readFileSync(path.join(root,file), 'utf8');
  const modules = [...source.matchAll(/from '([^']+\.provider)'/g)].map((m) => m[1]);
  const overrides = Object.fromEntries(modules.map((name) => [name, provider]));
  const h = harness({ POSTDELEGATE_LAUNCH_MODE: 'lean', POSTDELEGATE_ENABLED_PROVIDERS: 'linkedin,facebook' }, overrides);
  const { IntegrationManager, socialIntegrationList } = h.load(file);
  assert.deepEqual(Array.from(socialIntegrationList, (p) => p.identifier).sort(), ['facebook','linkedin']);
  const manager = new IntegrationManager();
  assert.equal(manager.getSocialIntegration('linkedin').identifier, 'linkedin');
  assert.throws(() => manager.getSocialIntegration('x'), (error) => error.response.code === 'CHANNEL_DISABLED');
});

test('tool loader excludes hosted generators before constructing their tool schemas', async () => {
  let ran = [];
  class Free { name = 'integrationList'; async run() { ran.push(this.name); return { free:true }; } }
  class Paid { name = 'generateImageTool'; async run() { throw new Error('Paid schema must not load'); } }
  const h = harness(undefined, { '@gitroom/nestjs-libraries/chat/tools/tool.list': { toolList: [Free, Paid] } });
  const { LoadToolsService } = h.load('libraries/nestjs-libraries/src/chat/load.tools.service.ts');
  const service = new LoadToolsService({ get: (Class) => new Class() });
  const tools = await service.loadTools();
  assert.deepEqual(Object.keys(tools), ['integrationList']);
  assert.deepEqual(ran, ['integrationList']);
  await assert.rejects(() => service.agent(), (error) => error.getStatus() === 403);
});

test('lean MCP starts without constructing or exposing a hosted model agent', async () => {
  let serverConfig, toolLoads = 0;
  class MastraService {}
  class OrganizationService {}
  class OAuthService {}
  const routes = [];
  const h = harness({ POSTDELEGATE_LAUNCH_MODE: 'lean', NEXT_PUBLIC_BACKEND_URL: 'https://app.postdelegate.com/api' }, {
    '@gitroom/nashr-brand/brand.config': { brand: {name:'PostDelegate'} },
    '@gitroom/nestjs-libraries/chat/mastra.service': { MastraService },
    '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service': { OrganizationService },
    '@gitroom/nestjs-libraries/database/prisma/oauth/oauth.service': { OAuthService },
    '@mastra/mcp': { MCPServer: class { constructor(config) { serverConfig=config; } } },
    './oauth-middleware': { createOAuthMiddleware: () => () => {} },
  });
  const { startMcp } = h.load('libraries/nestjs-libraries/src/chat/start.mcp.ts');
  await startMcp({
    get: (Class) => Class === MastraService ? {
      mastra: () => { throw new Error('Hosted model must never initialize'); },
      tools: async () => { toolLoads++; return {integrationList:{}}; },
    } : {},
    use: (route) => routes.push(route),
  });
  assert.equal(toolLoads, 1);
  assert.equal('agents' in serverConfig, false);
  assert.deepEqual(Object.keys(serverConfig.tools), ['integrationList']);
  assert.ok(routes.includes('/mcp'));
  assert.ok(routes.includes('/mcp-oauth'));
});

test('paid media generation routes require the hosted-AI guard while ordinary uploads remain available', () => {
  const source = fs.readFileSync(path.join(root, 'apps/backend/src/api/routes/media.controller.ts'), 'utf8');
  for (const route of [
    '/generate-video', '/generate-image', '/generate-image-with-prompt',
    '/video-options', '/video/function', '/generate-video/:type/allowed',
  ]) {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(source, new RegExp(`@(Get|Post)\\('${escaped}'\\)\\s+@UseGuards\\(HostedAiGuard\\)`));
  }
  assert.match(source, /@Post\('\/upload-simple'\)/);
  assert.doesNotMatch(source, /@Post\('\/upload-simple'\)\s+@UseGuards\(HostedAiGuard\)/);
});

test('UI uses a native textarea and no hosted runtime provider in lean mode', () => {
  const jsx = (type, props) => ({ type, props });
  const h = harness(undefined, {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment:'fragment' },
    '@gitroom/react/helpers/variable.context': { useLaunchCapabilities: () => ({hostedAi:false}), useVariables: () => ({backendUrl:'https://app.postdelegate.com/api'}) },
  });
  const { OptionalAiProvider, OptionalAiTextarea } = h.load('apps/frontend/src/components/layout/optional-ai.tsx');
  assert.equal(OptionalAiProvider({children:'editor'}).type, 'fragment');
  const onChange = () => {};
  const node = OptionalAiTextarea({value:'Post text',onChange,placeholder:'Write'});
  assert.equal(node.type, 'textarea');
  assert.equal(node.props.value, 'Post text');
  assert.equal(node.props.onChange, onChange);
});
