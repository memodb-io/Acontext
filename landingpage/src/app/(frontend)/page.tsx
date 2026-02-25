import Script from 'next/script'
import { Hero, Features, Quickstart, CommunityCTA, FeaturesOverview, SelfHostCTA } from '@/components/landing'
import { WithCustomCursor } from '@/components/with-custom-cursor'
import { createOrganizationJsonLd, createWebSiteJsonLd, generateJsonLdScript } from '@/lib/jsonld'

const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://acontext.io'

export default function HomePage() {
  const organizationJsonLd = createOrganizationJsonLd('Acontext', baseUrl, {
    description:
      'The Agent Memory Stack - Unifies short-term memory, mid-term state, and long-term skill for production AI agents.',
    logo: `${baseUrl}/ACONTEXT_white.svg`,
    socialLinks: ['https://twitter.com/acontext_io'],
  })

  const websiteJsonLd = createWebSiteJsonLd('Acontext', baseUrl, {
    description:
      'Unifies short-term memory, mid-term state, and long-term skill for production AI agents — filesystem-compatible, configurable, and human-readable.',
  })

  return (
    <>
      <Script
        id="organization-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: generateJsonLdScript(organizationJsonLd),
        }}
      />
      <Script
        id="website-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: generateJsonLdScript(websiteJsonLd),
        }}
      />
      <Hero />
      {/* Features tabs with custom cursor - colors auto-adapt to theme */}
      <WithCustomCursor
        id="how-it-works"
        cursorStyle="glow"
        cursorSize={20}
        cursorFollowDelay={0}
        className="cursor-none **:cursor-none"
      >
        <FeaturesOverview />
      </WithCustomCursor>
      <Quickstart />
      <Features />
      <SelfHostCTA />
      <CommunityCTA />
    </>
  )
}
