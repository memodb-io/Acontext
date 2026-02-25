import Script from 'next/script'
import type { Metadata } from 'next'
import { Hero, Features, Capabilities, HowItWorks } from '@/components/mid-term-state'
import { createSoftwareApplicationJsonLd, generateJsonLdScript } from '@/lib/jsonld'

const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://acontext.io'

export const metadata: Metadata = {
  title: 'Mid-term State - Monitor AI Agent Sessions | Acontext',
  description:
    'Full observability into your AI agent sessions. Track agent tasks, traces, token usage, and session activity with built-in dashboards and analytics.',
  keywords: [
    'mid-term state',
    'AI agent monitoring',
    'agent tasks',
    'traces',
    'token usage',
    'session analytics',
    'dashboard',
  ],
  openGraph: {
    title: 'Mid-term State - Monitor AI Agent Sessions | Acontext',
    description:
      'Full observability into your AI agent sessions. Track agent tasks, traces, and token usage.',
    url: `${baseUrl}/product/mid-term-state`,
    siteName: 'Acontext',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mid-term State - Monitor AI Agent Sessions | Acontext',
    description:
      'Full observability into your AI agent sessions. Track agent tasks, traces, and token usage.',
  },
  alternates: {
    canonical: `${baseUrl}/product/mid-term-state`,
  },
}

export default function MidTermStatePage() {
  const jsonLd = createSoftwareApplicationJsonLd(
    'Acontext Mid-term State',
    'Full observability for AI agent sessions — track agent tasks, traces, token usage, and session analytics with built-in dashboards.',
    `${baseUrl}/product/mid-term-state`,
    {
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any',
      price: '0',
      priceCurrency: 'USD',
    },
  )

  return (
    <>
      <Script
        id="mid-term-state-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: generateJsonLdScript(jsonLd),
        }}
      />
      <Hero />
      <Features />
      <Capabilities />
      <HowItWorks />
    </>
  )
}
