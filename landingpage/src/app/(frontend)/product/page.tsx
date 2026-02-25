import Script from 'next/script'
import { Hero, Spotlight, Features } from '@/components/product'
import {
  createSoftwareApplicationJsonLd,
  generateJsonLdScript,
} from '@/lib/jsonld'
import type { Metadata } from 'next'

const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://acontext.io'

export const metadata: Metadata = {
  title: 'Product - Acontext',
  description:
    'Explore Acontext features - The Agent Memory Stack with short-term memory, mid-term state, and long-term skill for AI agents',
  alternates: {
    canonical: `${baseUrl}/product`,
  },
}

export default function ProductPage() {
  const softwareJsonLd = createSoftwareApplicationJsonLd(
    'Acontext',
    'The Agent Memory Stack - Unifies short-term memory, mid-term state, and long-term skill for production agents.',
    baseUrl,
    {
      applicationCategory: 'BusinessApplication',
      operatingSystem: ['Web', 'Cloud'],
    },
  )

  return (
    <>
      <Script
        id="software-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: generateJsonLdScript(softwareJsonLd),
        }}
      />
      <Hero />
      <Spotlight />
      <Features />
    </>
  )
}
