import { getPayload } from 'payload'
import Link from 'next/link'
import config from '@/payload.config'
import type { Post } from '@/payload-types'
import { BlogList } from './blog-list'
import type { Metadata } from 'next'

const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://acontext.io'

export const metadata: Metadata = {
  title: 'Blog - Acontext',
  description: 'Latest articles, tutorials, and updates from the Acontext team.',
  alternates: {
    canonical: `${baseUrl}/blog`,
  },
}

const categoryLabels: Record<string, string> = {
  article: 'Article',
  tutorial: 'Tutorial',
  'customer-story': 'Customer Story',
  announcement: 'Announcement',
  'release-notes': 'Release Notes',
}

export default async function BlogPage() {
  let posts: Post[] = []

  try {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'posts',
      sort: '-date',
      depth: 1,
      limit: 100,
    })
    posts = result.docs as Post[]
  } catch (error) {
    // Database may not be available during build (e.g., D1 tables not migrated yet)
    console.warn('Failed to fetch posts:', error)
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container-responsive">
        <div className="max-w-5xl mx-auto">
          {posts.length > 0 ? (
            <BlogList posts={posts} categoryLabels={categoryLabels} />
          ) : (
            <>
              {/* Header when no posts */}
              <header className="mb-12">
                <h1 className="text-5xl font-bold text-foreground max-md:text-4xl">Blog</h1>
              </header>
              <div className="text-center py-24">
                <p className="text-muted-foreground text-lg">
                  No posts yet. Create your first post in the{' '}
                  <Link
                    href="/admin"
                    className="text-primary hover:underline"
                    aria-label="Go to admin panel"
                  >
                    admin panel
                  </Link>
                  .
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
