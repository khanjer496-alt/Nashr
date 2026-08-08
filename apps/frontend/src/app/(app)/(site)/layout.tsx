import { cookies } from 'next/headers';
import { LayoutComponent } from '@gitroom/frontend/components/new-layout/layout.component';
import { PublicShell } from '@gitroom/frontend/components/layout/public.shell';

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  // `LayoutComponent` fetches /user/self and renders nothing until it resolves,
  // so it cannot host the signed-out public pages (/about, /terms, /privacy,
  // /licenses — the AGPL-3.0 §13 source offer must reach everyone). Only those
  // routes reach this branch: `proxy.ts` still redirects every other path to
  // /auth when the cookie is missing.
  const authCookie = (await cookies()).get('auth');
  if (!authCookie) {
    return <PublicShell>{children}</PublicShell>;
  }

  return <LayoutComponent>{children}</LayoutComponent>;
}
