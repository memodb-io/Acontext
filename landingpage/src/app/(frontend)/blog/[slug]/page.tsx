import type { Metadata } from 'next'
import { getPayload } from 'payload'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import Script from 'next/script'
import config from '@/payload.config'
import type { Post, Media } from '@/payload-types'
import { RichText, type JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'
import { CodeBlock } from '@/components/code-block'
import { createArticleJsonLd, createFAQPageJsonLd, generateJsonLdScript } from '@/lib/jsonld'
import { getImageInfo } from '@/lib/utils'

interface PageProps {
  params: Promise<{ slug: string }>
}

// Custom JSX converters for rich text rendering
const jsxConverters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,

  // Headings with anchor links
  heading: ({ node, nodesToJSX }) => {
    const children = nodesToJSX({ nodes: node.children })
    const Tag = node.tag as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
    const headingStyles: Record<string, string> = {
      h1: 'text-3xl font-bold mt-10 mb-4 text-foreground',
      h2: 'text-2xl font-semibold mt-8 mb-3 text-foreground border-b border-border pb-2',
      h3: 'text-xl font-semibold mt-6 mb-2 text-foreground',
      h4: 'text-lg font-medium mt-4 mb-2 text-foreground',
      h5: 'text-base font-medium mt-3 mb-1 text-foreground',
      h6: 'text-sm font-medium mt-2 mb-1 text-muted-foreground',
    }
    return <Tag className={headingStyles[node.tag]}>{children}</Tag>
  },

  // Paragraphs
  paragraph: ({ node, nodesToJSX }) => {
    const children = nodesToJSX({ nodes: node.children })
    return <p className="text-foreground/80 leading-relaxed mb-4">{children}</p>
  },

  // Blockquotes
  quote: ({ node, nodesToJSX }) => {
    const children = nodesToJSX({ nodes: node.children })
    return (
      <blockquote className="border-l-4 border-primary pl-4 my-6 italic text-muted-foreground bg-muted/30 py-3 pr-4 rounded-r-lg">
        {children}
      </blockquote>
    )
  },

  // Lists
  list: ({ node, nodesToJSX }) => {
    // When a numbered list contains items with headings (e.g. section headings typed as "1. Title"),
    // render the headings directly without the <ol> wrapper to avoid broken layout and "1." on each.
    const hasHeadingItems = node.children?.some((child) => {
      const c = child as unknown as { children?: { type?: string }[] }
      return c.children?.some((grandchild) => grandchild.type === 'heading')
    })
    if (hasHeadingItems) {
      const children = nodesToJSX({ nodes: node.children })
      return <>{children}</>
    }

    const children = nodesToJSX({ nodes: node.children })
    if (node.listType === 'number') {
      return <ol className="list-decimal list-inside space-y-2 mb-4 pl-4">{children}</ol>
    }
    if (node.listType === 'check') {
      return <ul className="space-y-2 mb-4">{children}</ul>
    }
    return <ul className="list-disc list-inside space-y-2 mb-4 pl-4">{children}</ul>
  },

  listitem: ({ node, nodesToJSX }) => {
    // If list item contains a heading, render the heading directly without <li> wrapper,
    // and prepend the list item number (e.g. "1. ", "2. ") to the heading text.
    const headingIndex = node.children?.findIndex(
      (child) => (child as unknown as { type?: string }).type === 'heading',
    )
    if (headingIndex !== undefined && headingIndex >= 0) {
      const headingNode = node.children[headingIndex] as unknown as {
        type: string
        tag: string
        children: unknown[]
      }
      const itemValue = (node as unknown as { value?: number }).value || 1
      // Inject a number prefix text node into the heading's children
      const numberedHeadingNode = {
        ...headingNode,
        children: [
          { type: 'text', text: `${itemValue}. `, format: 0, detail: 0, mode: 'normal', style: '', version: 1 },
          ...headingNode.children,
        ],
      }
      // Replace the heading node with the numbered version and render
      const modifiedChildren = [...node.children]
      modifiedChildren[headingIndex] = numberedHeadingNode as unknown as (typeof modifiedChildren)[0]
      const rendered = nodesToJSX({ nodes: modifiedChildren })
      return <>{rendered}</>
    }

    const children = nodesToJSX({ nodes: node.children })

    if (node.checked !== undefined) {
      return (
        <li className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={node.checked}
            readOnly
            className="mt-1.5 rounded border-border"
          />
          <span className={node.checked ? 'line-through text-muted-foreground' : ''}>
            {children}
          </span>
        </li>
      )
    }
    return <li className="text-foreground/80">{children}</li>
  },

  // Links
  link: ({ node, nodesToJSX }) => {
    const children = nodesToJSX({ nodes: node.children })
    const isExternal = node.fields.url?.startsWith('http')
    return (
      <a
        href={node.fields.url}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        className="text-primary hover:underline underline-offset-4"
      >
        {children}
        {isExternal && <span className="inline-block ml-1 text-xs">↗</span>}
      </a>
    )
  },

  // Horizontal rule
  horizontalrule: () => <hr className="my-8 border-border" />,

  // Tables
  table: ({ node, nodesToJSX }) => {
    const rows = node.children || []
    // Check if first row is a header row (all cells have headerState > 0)
    const firstRow = rows[0] as { children?: { headerState?: number }[] } | undefined
    const hasHeaderRow =
      firstRow?.children?.length && firstRow.children.every((cell) => (cell.headerState ?? 0) > 0)

    if (hasHeaderRow && rows.length > 1) {
      const headerRow = nodesToJSX({ nodes: [rows[0]] })
      const bodyRows = nodesToJSX({ nodes: rows.slice(1) })
      return (
        <div className="my-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/50">{headerRow}</thead>
            <tbody>{bodyRows}</tbody>
          </table>
        </div>
      )
    }

    const children = nodesToJSX({ nodes: rows })
    return (
      <div className="my-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <tbody>{children}</tbody>
        </table>
      </div>
    )
  },

  tablerow: ({ node, nodesToJSX }) => {
    const children = nodesToJSX({ nodes: node.children })
    return <tr className="border-b border-border last:border-b-0">{children}</tr>
  },

  tablecell: ({ node, nodesToJSX }) => {
    const children = nodesToJSX({ nodes: node.children })
    const isHeader = node.headerState > 0

    if (isHeader) {
      return (
        <th className="px-4 py-3 text-left font-semibold text-foreground bg-muted/50 border-r border-border last:border-r-0 [&_p]:mb-0">
          {children}
        </th>
      )
    }

    return (
      <td className="px-4 py-3 text-foreground/80 border-r border-border last:border-r-0 [&_p]:mb-0">
        {children}
      </td>
    )
  },

  // Upload/Images
  upload: ({ node }) => {
    const media = node.value as Media | undefined
    const imageInfo = getImageInfo(media)
    if (!imageInfo.url) return null
    return (
      <figure className="my-6">
        <Image
          src={imageInfo.url}
          alt={imageInfo.alt}
          width={media?.width || 800}
          height={media?.height || 400}
          className="rounded-xl border border-border w-full h-auto"
        />
        {imageInfo.alt && (
          <figcaption className="text-center text-sm text-muted-foreground mt-2">
            {imageInfo.alt}
          </figcaption>
        )}
      </figure>
    )
  },

  // Code blocks (via BlocksFeature) - slug is 'Code' with capital C
  blocks: {
    Code: ({ node }: { node: { fields: { code: string; language?: string } } }) => {
      const { code, language } = node.fields
      return <CodeBlock code={code} language={language} />
    },
  },
})

const categoryLabels: Record<string, string> = {
  article: 'Article',
  tutorial: 'Tutorial',
  'customer-story': 'Customer Story',
  announcement: 'Announcement',
  'release-notes': 'Release Notes',
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params

  let post: Post | undefined

  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'posts',
      where: { slug: { equals: slug } },
      depth: 1,
      limit: 1,
    })
    post = docs[0] as Post | undefined
  } catch (error) {
    // Database may not be available during build (e.g., D1 tables not migrated yet)
    console.warn('Failed to fetch post:', error)
  }

  if (!post) {
    notFound()
  }

  const image = post.image as Media | null

  const formattedDate = new Date(post.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Build absolute URLs
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://acontext.io'
  const postUrl = `${baseUrl}/blog/${slug}`

  // Create Article JSON-LD
  // Convert date to ISO 8601 format if needed
  const datePublished = post.date.includes('T') ? post.date : `${post.date}T00:00:00Z`
  const dateModified = post.updatedAt
    ? post.updatedAt.includes('T')
      ? post.updatedAt
      : `${post.updatedAt}T00:00:00Z`
    : undefined

  const imageInfo = getImageInfo(image)
  const articleJsonLd = createArticleJsonLd(post.title, datePublished, postUrl, {
    description: post.excerpt || undefined,
    image: imageInfo.absoluteUrl,
    dateModified,
    authorName: 'Acontext',
    publisherName: 'Acontext',
    publisherLogo: `${baseUrl}/ACONTEXT_white.svg`,
    type: 'BlogPosting',
    inLanguage: 'en-US',
    articleSection: categoryLabels[post.category || 'article'],
  })

  // Create FAQ JSON-LD if FAQ items exist
  const faqItems = post.meta?.faq as { question: string; answer: string }[] | undefined
  const faqJsonLd = createFAQPageJsonLd(faqItems || [])

  return (
    <div className="min-h-screen pt-24 pb-16">
      <Script
        id="article-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: generateJsonLdScript(articleJsonLd),
        }}
      />
      {faqJsonLd && (
        <Script
          id="faq-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: generateJsonLdScript(faqJsonLd),
          }}
        />
      )}
      <article className="container-responsive">
        {/* Back Link */}
        <div className="max-w-5xl mx-auto">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 group"
            aria-label="Back to all blog posts"
          >
            <svg
              className="w-4 h-4 transition-transform group-hover:-translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            All blog posts
          </Link>
        </div>

        {/* Header */}
        <header className="max-w-5xl mx-auto mb-12">
          {/* Meta Row */}
          <div className="flex items-center gap-3 text-sm mb-6">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
              {categoryLabels[post.category || 'article']}
            </span>
            <span className="text-muted-foreground">•</span>
            <time className="text-muted-foreground">{formattedDate}</time>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-tight mb-6">
            {post.title}
          </h1>

          {/* Excerpt */}
          {post.excerpt && (
            <p className="text-xl text-muted-foreground leading-relaxed">{post.excerpt}</p>
          )}
        </header>

        {/* Cover Image */}
        {imageInfo.url && (
          <div className="max-w-5xl mx-auto mb-12 rounded-2xl overflow-hidden border border-border">
            <Image
              src={imageInfo.url}
              alt={imageInfo.alt || post.title}
              width={1200}
              height={630}
              className="w-full h-auto object-cover"
              priority
            />
          </div>
        )}

        {/* Content */}
        <div className="max-w-5xl mx-auto [&_strong]:font-semibold [&_strong]:text-foreground [&_em]:italic [&_code]:text-primary [&_code]:bg-primary/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono">
          {post.content && <RichText data={post.content} converters={jsxConverters} />}
        </div>

        {/* Footer */}
        <footer className="max-w-5xl mx-auto mt-16 pt-8 border-t border-border">
          <div className="flex items-center justify-between">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors group"
              aria-label="Back to all posts"
            >
              <svg
                className="w-4 h-4 transition-transform group-hover:-translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to all posts
            </Link>

            {/* Share buttons could go here */}
          </div>
        </footer>
      </article>
    </div>
  )
}

export async function generateStaticParams() {
  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'posts',
      depth: 0,
      limit: 100,
    })
    return docs.map((post) => ({ slug: post.slug }))
  } catch (error) {
    // Database may not be available during build (e.g., D1 tables not migrated yet)
    console.warn('Failed to generate static params for posts:', error)
    return []
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params

  let post: Post | undefined

  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'posts',
      where: { slug: { equals: slug } },
      depth: 1,
      limit: 1,
    })
    post = docs[0] as Post | undefined
  } catch (error) {
    // Database may not be available during build
    console.warn('Failed to fetch post metadata:', error)
  }

  if (!post) {
    return {
      title: 'Post Not Found - Acontext',
    }
  }

  // Use meta fields if set, otherwise fall back to post fields
  const seoTitle = post.meta?.title || post.title
  const seoDescription =
    post.meta?.description || post.excerpt || `Read ${post.title} on the Acontext blog.`
  const seoImage = (post.meta?.image as Media | null) || (post.image as Media | null)

  // Build canonical URL
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://acontext.io'
  const canonicalUrl = `${baseUrl}/blog/${slug}`

  const seoImageInfo = getImageInfo(seoImage)
  const absoluteImageUrl = seoImageInfo.absoluteUrl

  return {
    title: `${seoTitle} - Acontext Blog`,
    description: seoDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: seoTitle,
      description: seoDescription,
      type: 'article',
      siteName: 'Acontext',
      locale: 'en_US',
      publishedTime: post.date,
      modifiedTime: post.updatedAt,
      url: canonicalUrl,
      ...(absoluteImageUrl && {
        images: [{ url: absoluteImageUrl }],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      site: '@acontext_io',
      title: seoTitle,
      description: seoDescription,
      ...(absoluteImageUrl && {
        images: [absoluteImageUrl],
      }),
    },
  }
}
