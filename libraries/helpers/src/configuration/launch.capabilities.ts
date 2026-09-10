/** Deployment policy only. A configured credential is not platform approval.
 * Read on the server; pass only the resulting public booleans to the browser.
 * Changes require restarting the backend AND orchestrator.
 */
export type LaunchEnvironment = Record<string, string | undefined>;

export function getLaunchCapabilities(env: LaunchEnvironment = process.env) {
  const mode = env.POSTDELEGATE_LAUNCH_MODE?.trim() || 'standard';
  if (mode !== 'standard' && mode !== 'lean') {
    throw new Error('POSTDELEGATE_LAUNCH_MODE must be standard or lean');
  }
  const lean = mode === 'lean';
  return {
    lean,
    hostedAi: !lean,
    customAgents: !lean,
    designer: !lean && !!env.NEXT_PUBLIC_POLOTNO?.trim(),
    platformAnalytics: !lean,
  };
}

export function enabledProviderIds(env: LaunchEnvironment = process.env): string[] | undefined {
  const { lean } = getLaunchCapabilities(env);
  const value = env.POSTDELEGATE_ENABLED_PROVIDERS;
  // Preserve upstream behavior outside the opted-in release. Lean fails closed.
  if (value === undefined) return lean ? [] : undefined;
  const ids = [...new Set(value.split(',').map((id) => id.trim()).filter(Boolean))];
  if (ids.some((id) => !/^[a-z0-9][a-z0-9-]*$/.test(id))) {
    throw new Error('POSTDELEGATE_ENABLED_PROVIDERS must contain exact provider IDs, not wildcards');
  }
  if (lean && ids.includes('x')) {
    throw new Error('X requires a separately budgeted release; it cannot be enabled in lean mode');
  }
  return ids;
}

export function isProviderEnabled(id: string, env: LaunchEnvironment = process.env): boolean {
  const enabled = enabledProviderIds(env);
  return enabled === undefined || enabled.includes(id);
}

const leanTools = new Set([
  'integrationList', 'groupList', 'integrationSchema',
  'integrationSchedulePostTool', 'uploadFromUrlTool',
]);

/** Unknown/new tools stay off in lean mode until their side effects are reviewed. */
export function isLaunchToolEnabled(name: string, env: LaunchEnvironment = process.env): boolean {
  return !getLaunchCapabilities(env).lean || leanTools.has(name);
}
