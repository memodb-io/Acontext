import Script from 'next/script'
import type { Metadata } from 'next'
import { Hero, SandboxOverview, SandboxCodeComparison } from '@/components/sandbox'
import { StandaloneComparison, scenes } from '@/components/landing/acontext-vs-claude'
import { createSoftwareApplicationJsonLd, generateJsonLdScript } from '@/lib/jsonld'

const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://acontext.io'

export const metadata: Metadata = {
  title: 'Sandbox - Secure Code Execution | Acontext',
  description:
    'Execute code, manage files, and export results in secure, isolated sandbox environments. Simple, open-source, model-agnostic, and composable.',
  keywords: [
    'sandbox',
    'code execution',
    'AI agent',
    'LLM tools',
    'secure containers',
    'model agnostic',
    'open source',
  ],
  openGraph: {
    title: 'Sandbox - Secure Code Execution | Acontext',
    description:
      'Execute code, manage files, and export results in secure, isolated sandbox environments.',
    url: `${baseUrl}/product/sandbox`,
    siteName: 'Acontext',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sandbox - Secure Code Execution | Acontext',
    description:
      'Execute code, manage files, and export results in secure, isolated sandbox environments.',
  },
  alternates: {
    canonical: `${baseUrl}/product/sandbox`,
  },
}

export default function SandboxPage() {
  const sandboxJsonLd = createSoftwareApplicationJsonLd(
    'Acontext Sandbox',
    'Secure sandbox environment for executing code, managing files, and exporting results. Simple, open-source, model-agnostic, and composable.',
    `${baseUrl}/product/sandbox`,
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
        id="sandbox-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: generateJsonLdScript(sandboxJsonLd),
        }}
      />
      <Hero />
      <SandboxOverview />
      <StandaloneComparison scene={scenes[1]} />
      <StandaloneComparison scene={scenes[2]} />
      <SandboxCodeComparison />
    </>
  )
}
