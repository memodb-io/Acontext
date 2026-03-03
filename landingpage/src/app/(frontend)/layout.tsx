import React from 'react'
import Script from 'next/script'
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import { GoogleAnalytics, GoogleTagManager } from '@next/third-parties/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Header, Footer } from '@/components/landing'
import type { Metadata } from 'next'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
})

const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://acontext.io'

export const metadata: Metadata = {
  title: 'Agent Skills as a Memory Layer | Acontext',
  description:
    'Skill memory for AI agents — learns from runs, writes Markdown skill files, and reuses them on the next run. Human-readable, portable, no embeddings.',
  keywords: [
    'AI agents',
    'skill memory',
    'agent skills',
    'machine learning',
    'LLM',
    'autonomous agents',
    'open source',
    'learning space',
    'SKILL.md',
    'agent memory',
  ],
  alternates: {
    canonical: baseUrl,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/ico_black.svg', media: '(prefers-color-scheme: light)' },
      { url: '/ico_white.svg', media: '(prefers-color-scheme: dark)' },
    ],
    apple: '/ico_black.svg',
  },
  openGraph: {
    title: 'Agent Skills as a Memory Layer | Acontext',
    description:
      'Skill memory for AI agents — learns from runs, writes Markdown skill files, and reuses them on the next run. Human-readable, portable, no embeddings.',
    url: 'https://acontext.io',
    siteName: 'Acontext',
    type: 'website',
    images: [
      {
        url: 'https://assets.memodb.io/Acontext/page-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Acontext - Agent Skills as a Memory Layer',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@acontext_io',
    title: 'Agent Skills as a Memory Layer | Acontext',
    description:
      'Skill memory for AI agents — learns from runs, writes Markdown skill files, and reuses them on the next run. Human-readable, portable, no embeddings.',
    images: ['https://assets.memodb.io/Acontext/page-image.jpg'],
  },
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} dark`}
    >
      <body
        className="bg-background text-foreground font-sans antialiased"
        suppressHydrationWarning
      >
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('acontext-theme') || 'dark';
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
        <Script
          id="preload-logos"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var link1 = document.createElement('link');
                link1.rel = 'preload';
                link1.as = 'image';
                link1.href = '/nav-logo-black.svg';
                document.head.appendChild(link1);
                
                var link2 = document.createElement('link');
                link2.rel = 'preload';
                link2.as = 'image';
                link2.href = '/nav-logo-white.svg';
                document.head.appendChild(link2);
              })();
            `,
          }}
        />
        <GoogleTagManager gtmId="GTM-KQ7H272M" />
        <GoogleAnalytics gaId="G-Y2R02LY9NV" />
        <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
          <Header />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  )
}
