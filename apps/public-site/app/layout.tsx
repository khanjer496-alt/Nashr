import type { Metadata } from 'next';
import { Manrope, IBM_Plex_Sans_Arabic, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { brand } from '@gitroom/nashr-brand/brand.config';
import { PublicShell } from '@gitroom/frontend/components/layout/public.shell';
import './globals.scss';

const manrope = Manrope({ weight: ['500', '600', '700'], subsets: ['latin'], display: 'swap' });
const arabic = IBM_Plex_Sans_Arabic({ weight: ['400', '500', '600'], subsets: ['arabic'], display: 'swap', variable: '--postdelegate-font-arabic' });
const mono = JetBrains_Mono({ weight: ['500', '600'], subsets: ['latin'], display: 'swap', variable: '--postdelegate-font-mono' });

export const metadata: Metadata = {
  metadataBase: new URL(brand.appUrl),
  title: `${brand.name} | AI & Social Media Scheduling`,
  description: `Plan, schedule and manage social posts with ${brand.name}. Use the web workspace or connect an AI agent through MCP or the API. Currently in preview.`,
  applicationName: brand.name,
  robots: { index: false, follow: true },
  icons: { icon: brand.logo.favicon, apple: brand.logo.appleTouchIcon },
  openGraph: { title: brand.name, description: `Social media scheduling for people and AI agents. Plan content, review drafts and manage publishing in one workspace.`, url: brand.appUrl, images: [brand.logo.ogImage] },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body className={`${manrope.className} ${arabic.variable} ${mono.variable}`}>
        <PublicShell>{children}</PublicShell>
      </body>
    </html>
  );
}
