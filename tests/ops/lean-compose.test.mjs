import test from 'node:test';
import assert from 'node:assert/strict';
import { checkLeanCompose } from '../../ops/scripts/lean-preflight.mjs';

function valid() {
  return { services: { app: {
    image: `ghcr.io/khanjer496-alt/postdelegate@sha256:${'a'.repeat(64)}`,
    environment: {
      POSTDELEGATE_LAUNCH_MODE: 'lean', POSTDELEGATE_ENABLED_PROVIDERS: '',
      DISABLE_REGISTRATION: 'true', STORAGE_PROVIDER: 'cloudflare',
      ...Object.fromEntries(['OPENAI_API_KEY','FAL_KEY','NEXT_PUBLIC_POLOTNO','TRANSLOADIT_AUTH','TRANSLOADIT_TEMPLATE',
        'X_API_KEY','X_API_SECRET','STRIPE_SECRET_KEY','STRIPE_PUBLISHABLE_KEY','STRIPE_SIGNING_KEY'].map((key) => [key, ''])),
    },
  }, postgres: {}, redis: {}, temporal: {}, 'temporal-postgres': {}, 'temporal-elasticsearch': {} }, volumes: { postgres: {} } };
}

test('lean merged config is valid with no channels enabled; never asserts launch approval', () => {
  const report = checkLeanCompose(valid());
  assert.equal(report.ok, true);
  assert.deepEqual(report.enabledProviders, []);
  assert.match(report.notice, /does not verify approval/);
});
test('only an explicit approved-channel list can activate connections', () => {
  const config = valid();
  config.services.app.environment.POSTDELEGATE_ENABLED_PROVIDERS = 'linkedin, facebook,linkedin';
  assert.deepEqual(checkLeanCompose(config).enabledProviders, ['linkedin', 'facebook']);
  for (const list of ['x','linkedin,x','*','linkedin;echo']) {
    config.services.app.environment.POSTDELEGATE_ENABLED_PROVIDERS = list;
    assert.equal(checkLeanCompose(config).ok, false);
  }
});
test('retained paid secrets block the check without disclosing their value', () => {
  const config = valid();
  config.services.app.environment.OPENAI_API_KEY = 'never-print-this-value';
  const report = checkLeanCompose(config);
  assert.equal(report.ok, false);
  assert.match(report.errors.join(), /OPENAI_API_KEY/);
  assert.doesNotMatch(JSON.stringify(report), /never-print-this-value/);
});
test('floating images, missing persistence, unsafe flags and public DB ports fail', () => {
  for (const mutate of [
    (c) => { c.services.app.image = 'ghcr.io/khanjer496-alt/postdelegate:latest'; },
    (c) => { c.services.app.environment.NOT_SECURED = 'false'; },
    (c) => { c.services.app.environment.DISABLE_REGISTRATION = 'false'; },
    (c) => { c.services.postgres.ports = [{ target: 5432, published: '5432' }]; },
    (c) => { delete c.services['temporal-postgres']; },
    (c) => { c.volumes = {}; },
  ]) {
    const config = valid(); mutate(config); assert.equal(checkLeanCompose(config).ok, false);
  }
});
