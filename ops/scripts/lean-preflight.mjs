#!/usr/bin/env node
/** Inspect merged Compose JSON via stdin; never print secret values. */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export function checkLeanCompose(config) {
  const errors = [];
  const app = config?.services?.app;
  const env = app?.environment || {};
  if (!app) errors.push('Application service missing');
  if (!/^ghcr\.io\/khanjer496-alt\/postdelegate@sha256:[a-f0-9]{64}$/.test(app?.image || '')) {
    errors.push('Application must use the exact PostDelegate registry digest');
  }
  if (env.POSTDELEGATE_LAUNCH_MODE !== 'lean') errors.push('Lean mode is not enforced');
  if (env.DISABLE_REGISTRATION !== 'true') errors.push('Public registration must remain closed');
  if (env.STORAGE_PROVIDER !== 'cloudflare') errors.push('Use the existing R2 storage topology');
  if ('NOT_SECURED' in env || env.DISABLE_SSRF_PROTECTION === 'true') errors.push('Unsafe security override');
  const paid = ['OPENAI_API_KEY','FAL_KEY','NEXT_PUBLIC_POLOTNO','TRANSLOADIT_AUTH','TRANSLOADIT_TEMPLATE',
    'X_API_KEY','X_API_SECRET','STRIPE_SECRET_KEY','STRIPE_PUBLISHABLE_KEY','STRIPE_SIGNING_KEY'];
  for (const key of paid) if (env[key] !== '') errors.push(`${key} must be explicitly empty in the lean overlay`);
  const raw = env.POSTDELEGATE_ENABLED_PROVIDERS;
  const providers = typeof raw === 'string' ? [...new Set(raw.split(',').map((id) => id.trim()).filter(Boolean))] : [];
  if (typeof raw !== 'string' || providers.some((id) => !/^[a-z0-9][a-z0-9-]*$/.test(id)) || providers.includes('x')) {
    errors.push('Provider allowlist must contain explicit IDs and exclude X');
  }
  for (const name of ['postgres','redis','temporal','temporal-postgres','temporal-elasticsearch']) {
    const service = config?.services?.[name];
    if (!service) errors.push(`Required existing service missing: ${name}`);
    if (service?.ports?.some((port) => typeof port === 'string' || !['127.0.0.1','::1'].includes(port.host_ip))) {
      errors.push(`Internal service exposed: ${name}`);
    }
  }
  if (!Object.keys(config?.volumes || {}).length) errors.push('Persistent volumes missing');
  return {
    ok: errors.length === 0, errors, enabledProviders: providers,
    notice: 'Configuration check only. Empty provider list enables no social connections. This does not verify approval, host capacity, encryption, backups, email or real publishing.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    let input = '';
    for await (const chunk of process.stdin) {
      input += chunk;
      if (input.length > 2_000_000) throw new Error();
    }
    const report = checkLeanCompose(JSON.parse(input));
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
  } catch {
    console.error('Unable to validate merged Compose configuration; no values logged.');
    process.exitCode = 1;
  }
}
