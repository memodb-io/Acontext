/**
 * JSON-LD Structured Data utilities
 * Helps search engines understand your content better
 */

export interface OrganizationJsonLd {
  '@context': 'https://schema.org'
  '@type': 'Organization'
  name: string
  url: string
  logo?: string
  description?: string
  sameAs?: string[]
  contactPoint?: {
    '@type': 'ContactPoint'
    contactType: string
    email?: string
    url?: string
  }
}

export interface WebSiteJsonLd {
  '@context': 'https://schema.org'
  '@type': 'WebSite'
  name: string
  url: string
  description?: string
  potentialAction?: {
    '@type': 'SearchAction'
    target: {
      '@type': 'EntryPoint'
      urlTemplate: string
    }
    'query-input': string
  }
}

export interface ArticleJsonLd {
  '@context': 'https://schema.org'
  '@type': 'Article' | 'BlogPosting'
  headline: string
  description?: string
  image?: string | string[] | {
    '@type': 'ImageObject'
    url: string
    width?: number
    height?: number
  }[]
  datePublished: string
  dateModified?: string
  author: {
    '@type': 'Organization' | 'Person'
    name: string
    url?: string
  }
  publisher: {
    '@type': 'Organization'
    name: string
    logo?: {
      '@type': 'ImageObject'
      url: string
    }
  }
  mainEntityOfPage?: {
    '@type': 'WebPage'
    '@id': string
  }
  inLanguage?: string
  articleSection?: string
}

export interface SoftwareApplicationJsonLd {
  '@context': 'https://schema.org'
  '@type': 'SoftwareApplication'
  name: string
  description: string
  url: string
  applicationCategory: string
  operatingSystem?: string | string[]
  offers?: {
    '@type': 'Offer'
    price?: string
    priceCurrency?: string
  }
  aggregateRating?: {
    '@type': 'AggregateRating'
    ratingValue: string
    ratingCount: string
  }
}

export interface ProductJsonLd {
  '@context': 'https://schema.org'
  '@type': 'Product' | 'Service'
  name: string
  description: string
  brand?: {
    '@type': 'Brand'
    name: string
  }
  offers?: {
    '@type': 'Offer' | 'AggregateOffer'
    price?: string
    priceCurrency?: string
    availability?: string
    url?: string
  }
}

export interface FAQPageJsonLd {
  '@context': 'https://schema.org'
  '@type': 'FAQPage'
  mainEntity: {
    '@type': 'Question'
    name: string
    acceptedAnswer: {
      '@type': 'Answer'
      text: string
    }
  }[]
}

/**
 * Generate JSON-LD script tag content
 * Removes undefined values to ensure clean JSON output
 */
export function generateJsonLdScript(data: unknown): string {
  // Remove undefined values to ensure clean JSON
  const cleaned = JSON.parse(JSON.stringify(data))
  return JSON.stringify(cleaned, null, 2)
}

/**
 * Create Organization JSON-LD
 */
export function createOrganizationJsonLd(
  name: string,
  url: string,
  options?: {
    logo?: string
    description?: string
    socialLinks?: string[]
    email?: string
  },
): OrganizationJsonLd {
  const jsonLd: OrganizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url,
  }

  if (options?.logo) {
    jsonLd.logo = options.logo
  }

  if (options?.description) {
    jsonLd.description = options.description
  }

  if (options?.socialLinks && options.socialLinks.length > 0) {
    jsonLd.sameAs = options.socialLinks
  }

  if (options?.email) {
    jsonLd.contactPoint = {
      '@type': 'ContactPoint',
      contactType: 'Customer Service',
      email: options.email,
    }
  }

  return jsonLd
}

/**
 * Create WebSite JSON-LD
 */
export function createWebSiteJsonLd(
  name: string,
  url: string,
  options?: {
    description?: string
    searchUrl?: string
  },
): WebSiteJsonLd {
  const jsonLd: WebSiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url,
  }

  if (options?.description) {
    jsonLd.description = options.description
  }

  if (options?.searchUrl) {
    jsonLd.potentialAction = {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: options.searchUrl,
      },
      'query-input': 'required name=search_term_string',
    }
  }

  return jsonLd
}

/**
 * Create Article JSON-LD
 * @param headline - Article headline/title
 * @param datePublished - ISO 8601 date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)
 * @param url - Canonical URL of the article
 * @param options - Additional options for the article
 */
export function createArticleJsonLd(
  headline: string,
  datePublished: string,
  url: string,
  options?: {
    description?: string
    image?: string | string[]
    dateModified?: string
    authorName?: string
    authorUrl?: string
    publisherName?: string
    publisherLogo?: string
    type?: 'Article' | 'BlogPosting'
    inLanguage?: string
    articleSection?: string
  },
): ArticleJsonLd {
  // Ensure datePublished is in ISO 8601 format
  // If it's just a date (YYYY-MM-DD), convert to full datetime
  let formattedDatePublished = datePublished
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePublished)) {
    // If only date provided, add time component (midnight UTC)
    formattedDatePublished = `${datePublished}T00:00:00Z`
  }

  // Format dateModified if provided
  let formattedDateModified: string | undefined
  if (options?.dateModified) {
    formattedDateModified = /^\d{4}-\d{2}-\d{2}$/.test(options.dateModified)
      ? `${options.dateModified}T00:00:00Z`
      : options.dateModified
  }

  const jsonLd: ArticleJsonLd = {
    '@context': 'https://schema.org',
    '@type': options?.type || 'BlogPosting',
    headline,
    datePublished: formattedDatePublished,
    author: {
      '@type': 'Organization',
      name: options?.authorName || 'Acontext',
      ...(options?.authorUrl && { url: options.authorUrl }),
      url,
    },
    publisher: {
      '@type': 'Organization',
      name: options?.publisherName || 'Acontext',
      ...(options?.publisherLogo && {
        logo: {
          '@type': 'ImageObject',
          url: options.publisherLogo,
        },
      }),
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    inLanguage: options?.inLanguage || 'en-US',
  }

  if (options?.description) {
    jsonLd.description = options.description
  }

  if (options?.image) {
    // Convert single string to array, or keep array as is
    jsonLd.image = Array.isArray(options.image) ? options.image : [options.image]
  }

  if (formattedDateModified) {
    jsonLd.dateModified = formattedDateModified
  }

  if (options?.articleSection) {
    jsonLd.articleSection = options.articleSection
  }

  return jsonLd
}

/**
 * Create SoftwareApplication JSON-LD
 */
export function createSoftwareApplicationJsonLd(
  name: string,
  description: string,
  url: string,
  options?: {
    applicationCategory?: string
    operatingSystem?: string | string[]
    price?: string
    priceCurrency?: string
    ratingValue?: string
    ratingCount?: string
  },
): SoftwareApplicationJsonLd {
  const jsonLd: SoftwareApplicationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    description,
    url,
    applicationCategory: options?.applicationCategory || 'BusinessApplication',
  }

  if (options?.operatingSystem) {
    jsonLd.operatingSystem = options.operatingSystem
  }

  if (options?.price) {
    jsonLd.offers = {
      '@type': 'Offer',
      price: options.price,
      priceCurrency: options?.priceCurrency || 'USD',
    }
  }

  if (options?.ratingValue && options?.ratingCount) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: options.ratingValue,
      ratingCount: options.ratingCount,
    }
  }

  return jsonLd
}

/**
 * Create FAQPage JSON-LD
 * @param faqs - Array of FAQ items with question and answer
 */
export function createFAQPageJsonLd(
  faqs: { question: string; answer: string }[],
): FAQPageJsonLd | null {
  if (!faqs || faqs.length === 0) {
    return null
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}
