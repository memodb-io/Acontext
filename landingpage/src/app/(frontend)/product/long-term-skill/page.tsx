import Script from 'next/script'
import type { Metadata } from 'next'
import { Hero, Comparison, Advantages, HowItWorks } from '@/components/long-term-skill'
import { createSoftwareApplicationJsonLd, generateJsonLdScript } from '@/lib/jsonld'

const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://acontext.io'

export const metadata: Metadata = {
  title: 'Long-term Skill - Agent Memory as Skills | Acontext',
  description:
    'Agent memory stored as skills — filesystem-compatible, configurable, and human-readable. No opaque embeddings. No vendor lock-in.',
  keywords: [
    'long-term skill',
    'agent memory',
    'AI agent',
    'filesystem memory',
    'human-readable memory',
    'open source',
  ],
  openGraph: {
    title: 'Long-term Skill - Agent Memory as Skills | Acontext',
    description:
      'Agent memory stored as skills — filesystem-compatible, configurable, and human-readable.',
    url: `${baseUrl}/product/long-term-skill`,
    siteName: 'Acontext',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Long-term Skill - Agent Memory as Skills | Acontext',
    description:
      'Agent memory stored as skills — filesystem-compatible, configurable, and human-readable.',
  },
  alternates: {
    canonical: `${baseUrl}/product/long-term-skill`,
  },
}

export default function LongTermSkillPage() {
  const longTermSkillJsonLd = createSoftwareApplicationJsonLd(
    'Acontext Long-term Skill',
    'Long-term skill for AI agents — store agent memory as filesystem-compatible, configurable, human-readable skill files.',
    `${baseUrl}/product/long-term-skill`,
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
        id="long-term-skill-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: generateJsonLdScript(longTermSkillJsonLd),
        }}
      />
      <Hero />
      <Advantages />
      <Comparison />
      <HowItWorks />
    </>
  )
}
