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
    'Explore Acontext features - Context Data Platform that Learns Skills with multi-modal storage, observability, and automatic skill learning',
  alternates: {
    canonical: `${baseUrl}/product`,
  },
}

export default function ProductPage() {
  const softwareJsonLd = createSoftwareApplicationJsonLd(
    'Acontext',
    'Context Data Platform that Learns Skills - Unifies multi-modal context data storage, observability, and automatic skill learning for production agents.',
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
