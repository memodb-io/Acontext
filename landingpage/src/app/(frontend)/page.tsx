import Script from 'next/script'
import { Hero, Features, CommunityCTA, FeaturesOverview, AcontextVsClaude } from '@/components/landing'
import { WithCustomCursor } from '@/components/with-custom-cursor'
import { createOrganizationJsonLd, createWebSiteJsonLd, generateJsonLdScript } from '@/lib/jsonld'

const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://acontext.io'

export default function HomePage() {
  const organizationJsonLd = createOrganizationJsonLd('Acontext', baseUrl, {
    description:
      'Context Data Platform for AI Agents - Unifies multi-modal context data storage, observability, and experience learning for production agents.',
    logo: `${baseUrl}/ACONTEXT_white.svg`,
    socialLinks: ['https://twitter.com/acontext_io'],
  })

  const websiteJsonLd = createWebSiteJsonLd('Acontext', baseUrl, {
    description:
      'Build smarter, more reliable AI agents with Acontext, which unifies multi-modal context data storage, observability, and experience learning for production agents.',
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
      <Features />
      <AcontextVsClaude />
      <CommunityCTA />
    </>
  )
}
