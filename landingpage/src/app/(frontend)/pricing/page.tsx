import Script from 'next/script'
import { Hero, PricingTable, FAQ } from '@/components/pricing'
import type { PricingData } from '@/components/pricing/pricing-table'
import { generateJsonLdScript } from '@/lib/jsonld'
import type { ProductJsonLd } from '@/lib/jsonld'
import type { Metadata } from 'next'

const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://acontext.io'

export const metadata: Metadata = {
  title: 'Pricing - Acontext',
  description: 'Simple, transparent pricing for Acontext - Context Data Platform for AI Agents',
  alternates: {
    canonical: `${baseUrl}/pricing`,
  },
}

async function fetchPricingData(): Promise<PricingData | null> {
  try {
    const response = await fetch(
      'https://zzdszdbxsoztirtihcet.supabase.co/functions/v1/get-prices-by-product',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        next: {
          revalidate: 3600, // Revalidate every hour
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch pricing data: ${response.statusText}`)
    }

    const data = await response.json()
    return data as PricingData
  } catch (error) {
    console.error('Error fetching pricing data:', error)
    return null
  }
}

export default async function PricingPage() {
  const data = await fetchPricingData()
  const error = data ? null : 'Failed to load pricing data'

  // Create Service JSON-LD for pricing page
  const serviceJsonLd: ProductJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Acontext - Context Data Platform for AI Agents',
    description:
      'Context Data Platform for AI Agents with multi-modal storage, observability, and experience learning',
    brand: {
      '@type': 'Brand',
      name: 'Acontext',
    },
  }

  return (
    <>
      <Script
        id="service-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: generateJsonLdScript(serviceJsonLd),
        }}
      />
      <Hero />
      <PricingTable data={data} error={error} />
      <FAQ />
    </>
  )
}
