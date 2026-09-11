#!/usr/bin/env node
/** Render real Compose files with synthetic config; no daemon or secrets needed. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { checkLeanCompose } from '../../ops/scripts/lean-preflight.mjs';

const directory = mkdtempSync(join(tmpdir(), 'postdelegate-compose-check-'));
const envPath = join(directory, '.env.fixture');
const fixture = {
  NASHR_ENV_FILE: envPath, NASHR_DOMAIN: 'app.postdelegate.com',
  NASHR_STAGING_DOMAIN: 'staging.postdelegate.com',
  NASHR_IMAGE: 'ghcr.io/khanjer496-alt/postdelegate', NASHR_IMAGE_TAG: 'fixture-only',
  POSTDELEGATE_IMAGE_DIGEST: `sha256:${'a'.repeat(64)}`,
  ACME_EMAIL: 'fixture@example.invalid', JWT_SECRET: 'fixture-not-for-production',
  POSTGRES_PASSWORD: 'fixture-not-for-production', REDIS_PASSWORD: 'fixture-not-for-production',
  TEMPORAL_POSTGRES_PASSWORD: 'fixture-not-for-production', STORAGE_PROVIDER: 'cloudflare',
  NEXT_PUBLIC_SOURCE_URL: `https://github.com/khanjer496-alt/Nashr/tree/${'a'.repeat(40)}`,
  STAGING_BASIC_AUTH_USER: 'fixture', STAGING_BASIC_AUTH_HASH: 'fixture-not-for-production',
  OPENAI_API_KEY: 'should-be-overridden', FAL_KEY: 'should-be-overridden',
  NEXT_PUBLIC_POLOTNO: 'should-be-overridden', STRIPE_SECRET_KEY: 'should-be-overridden',
};
try {
  writeFileSync(envPath, Object.entries(fixture).map(([key,value]) => `${key}=${JSON.stringify(value)}`).join('\n'), {mode:0o600});
  for (const target of ['prod','staging']) {
    const output = execFileSync('docker', ['compose','--env-file',envPath,'-f',`docker-compose.${target}.yaml`,
      '-f','docker-compose.lean.yaml','config','--format','json'], {
      encoding:'utf8', maxBuffer:2_000_000,
      env: { PATH:process.env.PATH, HOME:process.env.HOME, DOCKER_CONFIG:process.env.DOCKER_CONFIG },
      stdio:['ignore','pipe','pipe'],
    });
    const config = JSON.parse(output);
    const report = checkLeanCompose(config);
    assert.equal(report.ok, true, report.errors.join('; '));
    assert.equal(config.services.app.build.args.NEXT_PUBLIC_POLOTNO, '');
    assert.equal(config.services.temporal.environment.ENABLE_ES, 'false');
    assert.equal(config.services.temporal.environment.ES_SEEDS, '');
    assert.ok(config.services['temporal-elasticsearch']?.profiles?.includes('temporal-es'));
    assert.equal(config.name, target === 'prod' ? 'nashr-prod' : 'nashr-staging');
    assert.ok(Object.values(config.volumes).every((volume) => volume.name.startsWith(config.name)), 'Volume boundary changed');
    console.log(`${target}: merged lean policy, exact digest and isolated volumes passed (configuration only)`);
  }
} finally {
  // Only this test's freshly generated synthetic fixture is removed.
  rmSync(directory, {recursive:true,force:true});
}
