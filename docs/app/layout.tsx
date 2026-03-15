import { TreeContextProvider } from 'fumadocs-ui/contexts/tree';
import { NextProvider } from 'fumadocs-core/framework/next';
import { GoogleAnalytics, GoogleTagManager } from '@next/third-parties/google';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import { source } from '@/lib/source';
import './global.css';

export const metadata: Metadata = {
  title: {
    template: '%s | Acontext Docs',
    default: 'Acontext Docs',
  },
  description: 'Acontext — Agent Skills as a Memory Layer for production AI Agents',
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="flex min-h-screen flex-col" suppressHydrationWarning>
        <GoogleTagManager gtmId="GTM-KQ7H272M" />
        <GoogleAnalytics gaId="G-Y2R02LY9NV" />
        <NextProvider>
          <TreeContextProvider tree={source.getPageTree()}>
            <Providers>{children}</Providers>
          </TreeContextProvider>
        </NextProvider>
      </body>
    </html>
  );
}
