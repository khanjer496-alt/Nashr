/**
 * Nashr (نشر) — rate limiting (RISK-S6).
 *
 * Exercises the REAL `ThrottlerBehindProxyGuard` against a REAL Redis
 * (the same `ThrottlerStorageRedisService` production uses), driving it with
 * synthetic ExecutionContexts.
 *
 * Redis is required. Start one locally with:
 *   redis-server --port 6399 --daemonize yes --save ''
 * Point the suite elsewhere with NASHR_TEST_REDIS_URL.
 *
 * What this pins down, including one uncomfortable truth: the guard throttles
 * ONLY `POST /public/v1/posts`. Every other route — including the rest of the
 * public API and the whole authenticated API — returns true unconditionally.
 */
import { ExecutionContext } from '@nestjs/common';
import { ThrottlerBehindProxyGuard } from '@gitroom/nestjs-libraries/throttler/throttler.provider';

const REDIS_URL =
  process.env.NASHR_TEST_REDIS_URL || 'redis://127.0.0.1:6399';

let Redis: any;
let ThrottlerStorageRedisService: any;
let redis: any;
let storage: any;

const TTL_MS = 60_000;
const LIMIT = 5;

function ctx(over: { url?: string; method?: string; orgId?: string } = {}) {
  const req = {
    url: over.url ?? '/public/v1/posts',
    method: over.method ?? 'POST',
    org: { id: over.orgId ?? 'org-throttle-a' },
    ips: [],
    ip: '127.0.0.1',
    headers: {},
  };
  const res = { header: () => undefined, setHeader: () => undefined };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
    getHandler: () => function handler() {},
    getClass: () => class Ctrl {},
  } as unknown as ExecutionContext;
}

/**
 * The real guard with a real Redis storage. Nest normally injects the options,
 * the storage and a Reflector; here they are supplied directly.
 */
function makeGuard() {
  const options = {
    throttlers: [{ name: 'default', ttl: TTL_MS, limit: LIMIT }],
  };
  const reflector = {
    getAllAndOverride: () => undefined,
    get: () => undefined,
  } as any;
  const guard = new ThrottlerBehindProxyGuard(options as any, storage, reflector);
  // Nest calls this lifecycle hook; it normalises `options.throttlers` onto the
  // instance. Without it the guard is half-constructed.
  (guard as any).onModuleInit?.();
  return guard;
}

async function tryCall(guard: any, context: ExecutionContext) {
  try {
    await guard.canActivate(context);
    return 'allowed';
  } catch (err: any) {
    return err?.constructor?.name === 'ThrottlerException' ||
      /too many requests/i.test(err?.message ?? '')
      ? 'throttled'
      : `error:${err?.message}`;
  }
}

beforeAll(async () => {
  Redis = require('ioredis');
  ({ ThrottlerStorageRedisService } = require('@nest-lab/throttler-storage-redis'));
  redis = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    await redis.ping();
  } catch (err: any) {
    throw new Error(
      `Rate-limit tests need Redis at ${REDIS_URL}. Start one with:\n` +
        `  redis-server --port 6399 --daemonize yes --save ''\n${err?.message}`
    );
  }
  await redis.flushdb();
  storage = new ThrottlerStorageRedisService(redis);
});

afterAll(async () => {
  if (redis) {
    await redis.flushdb();
    await redis.quit();
  }
});

// ───────────────────────────────────────────────────────────────────────────
describe('the public post endpoint is limited', () => {
  it('allows exactly `limit` calls, then throttles', async () => {
    const guard = makeGuard();
    const org = `org-limit-${Date.now()}`;
    const results: string[] = [];

    for (let i = 0; i < LIMIT + 3; i++) {
      results.push(await tryCall(guard, ctx({ orgId: org })));
    }

    expect(results.slice(0, LIMIT)).toEqual(Array(LIMIT).fill('allowed'));
    expect(results.slice(LIMIT)).toEqual(['throttled', 'throttled', 'throttled']);
  });

  it('the budget is PER ORGANIZATION — one tenant cannot exhaust another\'s', async () => {
    const guard = makeGuard();
    const orgA = `org-a-${Date.now()}`;
    const orgB = `org-b-${Date.now()}`;

    for (let i = 0; i < LIMIT + 2; i++) {
      await tryCall(guard, ctx({ orgId: orgA }));
    }
    expect(await tryCall(guard, ctx({ orgId: orgA }))).toBe('throttled');
    // A different tenant starts with a full budget.
    expect(await tryCall(guard, ctx({ orgId: orgB }))).toBe('allowed');
  });

  it('the tracker key is derived from the organization id, not the IP', async () => {
    const guard: any = makeGuard();
    const key = await guard.getTracker({
      org: { id: 'org-xyz' },
      url: '/public/v1/posts',
    });
    expect(key).toContain('org-xyz');
    expect(key).toBe('org-xyz_posts');
  });

  it('post and non-post buckets are tracked separately', async () => {
    const guard: any = makeGuard();
    const posts = await guard.getTracker({
      org: { id: 'org-1' },
      url: '/public/v1/posts',
    });
    const other = await guard.getTracker({
      org: { id: 'org-1' },
      url: '/public/v1/integrations',
    });
    expect(posts).not.toEqual(other);
    expect(posts).toBe('org-1_posts');
    expect(other).toBe('org-1_other');
  });
});

describe('what is NOT limited (RISK-S6 — pinned, and reported)', () => {
  /**
   * REPORTED, NOT CHANGED. `ThrottlerBehindProxyGuard.canActivate` returns
   * true for everything except `POST /public/v1/posts`. So a single
   * `API_LIMIT` protects one endpoint and nothing else: reads on the public
   * API, and the entire authenticated API, are unlimited.
   *
   * Widening this is a production behaviour change with real blast radius
   * (it would start returning 429 on paths that have never been limited), so
   * it belongs to a deliberate decision, not to a test run. It is written up
   * in TEST_PLAN.md as a pre-launch item.
   */
  it('GET on the public posts endpoint is NOT limited', async () => {
    const guard = makeGuard();
    const org = `org-get-${Date.now()}`;
    const results: string[] = [];
    for (let i = 0; i < LIMIT * 3; i++) {
      results.push(
        await tryCall(guard, ctx({ orgId: org, method: 'GET' }))
      );
    }
    expect(new Set(results)).toEqual(new Set(['allowed']));
  });

  it('other public API routes are NOT limited', async () => {
    const guard = makeGuard();
    const org = `org-other-${Date.now()}`;
    const results: string[] = [];
    for (let i = 0; i < LIMIT * 3; i++) {
      results.push(
        await tryCall(
          guard,
          ctx({ orgId: org, url: '/public/v1/integrations', method: 'POST' })
        )
      );
    }
    expect(new Set(results)).toEqual(new Set(['allowed']));
  });

  it('the authenticated dashboard API is NOT limited', async () => {
    const guard = makeGuard();
    const org = `org-dash-${Date.now()}`;
    const results: string[] = [];
    for (let i = 0; i < LIMIT * 3; i++) {
      results.push(
        await tryCall(guard, ctx({ orgId: org, url: '/posts', method: 'POST' }))
      );
    }
    expect(new Set(results)).toEqual(new Set(['allowed']));
  });
});

describe('configuration', () => {
  it('API_LIMIT drives the limit, defaulting to 90 per hour', () => {
    // Mirrors apps/backend/src/app.module.ts.
    const resolve = (env: Record<string, string | undefined>) =>
      env.API_LIMIT ? Number(env.API_LIMIT) : 90;

    expect(resolve({})).toBe(90);
    expect(resolve({ API_LIMIT: '10' })).toBe(10);
    // A non-numeric value becomes NaN, which disables limiting entirely.
    // Pinned so the footgun is visible; see TEST_PLAN.md.
    expect(Number.isNaN(resolve({ API_LIMIT: 'lots' }))).toBe(true);
  });
});
