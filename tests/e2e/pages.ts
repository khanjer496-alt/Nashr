/**
 * The route inventory the e2e suite knows about.
 *
 * `public` routes render for a signed-out visitor and are what this suite can
 * actually exercise today. `authenticated` routes need a live backend
 * (`/user/self` must resolve) — they are declared here so that the same specs
 * light up automatically the moment an environment can provide a session
 * cookie, rather than needing new files written.
 */

export type RouteKind = 'public' | 'authenticated';

export interface RouteDef {
  /** Screenshot basename: `docs/screenshots/<name>-<lang>.png`. */
  name: string;
  path: string;
  kind: RouteKind;
  /**
   * Why this route needs auth / what RTL-critical component it carries.
   * Surfaced in the skip message so a skipped run is self-documenting.
   */
  note?: string;
}

/**
 * Reachable with no `auth` cookie.
 *
 * `/about`, `/terms`, `/privacy`, `/licenses` are allow-listed in
 * `apps/frontend/src/proxy.ts` (`publicPages`) — `/licenses` carries the
 * AGPL-3.0 §13 source offer and must reach every network user.
 * The `/auth/*` routes are public by construction (proxy only redirects
 * *away* from them when an auth cookie exists).
 */
export const PUBLIC_ROUTES: RouteDef[] = [
  { name: 'auth', path: '/auth', kind: 'public' },
  { name: 'login', path: '/auth/login', kind: 'public' },
  { name: 'forgot', path: '/auth/forgot', kind: 'public' },
  { name: 'about', path: '/about', kind: 'public' },
  { name: 'terms', path: '/terms', kind: 'public' },
  { name: 'privacy', path: '/privacy', kind: 'public' },
  { name: 'licenses', path: '/licenses', kind: 'public' },
];

/**
 * Behind the auth gate. Every one of these carries at least one component the
 * Phase 3 RTL audit changed but could not render.
 */
export const AUTHENTICATED_ROUTES: RouteDef[] = [
  {
    name: 'launches',
    path: '/launches',
    kind: 'authenticated',
    note: 'Calendar (week/month/day/list grids, dayjs locale, post chips, filters arrows) — the single highest-risk RTL surface.',
  },
  {
    name: 'analytics',
    path: '/analytics',
    kind: 'authenticated',
    note: 'statistics.tsx grid header logical corner radii (rounded-ss/se).',
  },
  {
    name: 'settings',
    path: '/settings',
    kind: 'authenticated',
    note: '.table1 tables, team list, react-tags widget.',
  },
  {
    name: 'media',
    path: '/media',
    kind: 'authenticated',
    note: 'media.component.tsx logical radii; Uppy dashboard ships its own unaudited [dir=rtl] stylesheet.',
  },
  {
    name: 'billing',
    path: '/billing',
    kind: 'authenticated',
    note: 'finish.trial.tsx overlay start-0.',
  },
  {
    name: 'agents',
    path: '/agents',
    kind: 'authenticated',
    note: 'agent.tsx / agent.chat.tsx, plus the agent_welcome_message left/right-menu copy bug.',
  },
  {
    name: 'plugs',
    path: '/plugs',
    kind: 'authenticated',
    note: 'Form controls under html[dir=rtl].',
  },
  {
    name: 'third-party',
    path: '/third-party',
    kind: 'authenticated',
    note: 'third-party.media-library.tsx overlay + text-start.',
  },
];

export const ALL_ROUTES = [...PUBLIC_ROUTES, ...AUTHENTICATED_ROUTES];
