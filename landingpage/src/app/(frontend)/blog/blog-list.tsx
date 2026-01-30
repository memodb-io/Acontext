'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Post } from '@/payload-types'
import { getImageInfo } from '@/lib/utils'

interface BlogListProps {
  posts: Post[]
  categoryLabels: Record<string, string>
}

const categories = [
  { value: 'all', label: 'All' },
  { value: 'article', label: 'Articles' },
  { value: 'tutorial', label: 'Tutorials' },
  { value: 'customer-story', label: 'Customer Stories' },
  { value: 'announcement', label: 'Announcements' },
  { value: 'release-notes', label: 'Release Notes' },
]

export function BlogList({ posts, categoryLabels }: BlogListProps) {
  const [activeCategory, setActiveCategory] = useState('all')

  const filteredPosts =
    activeCategory === 'all' ? posts : posts.filter((post) => post.category === activeCategory)

  // Get categories that have posts
  const categoriesWithPosts = categories.filter((cat) => {
    if (cat.value === 'all') return true
    return posts.some((post) => post.category === cat.value)
  })

  // Separate featured (first) post and rest
  const [featuredPost, ...restPosts] = filteredPosts

  return (
    <>
      {/* Header: Blog on left, Category Filters on right */}
      <header className="flex items-center justify-between gap-4 mb-12 flex-wrap">
        <h1 className="text-5xl font-bold text-foreground max-md:text-4xl">Blog</h1>
        {posts.length > 0 && (
          <nav className="flex flex-wrap gap-2">
            {categoriesWithPosts.map((category) => (
              <button
                key={category.value}
                onClick={() => setActiveCategory(category.value)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeCategory === category.value
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {category.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      {/* Featured Post - Latest */}
      {featuredPost && (
        <section className="mb-12">
          <FeaturedCard
            post={featuredPost}
            categoryLabel={categoryLabels[featuredPost.category || 'article']}
          />
        </section>
      )}

      {/* Posts Grid - 3 columns */}
      {restPosts.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {restPosts.map((post, index) => (
            <PostCard
              key={post.id}
              post={post}
              categoryLabel={categoryLabels[post.category || 'article']}
              index={index}
            />
          ))}
        </section>
      )}

      {filteredPosts.length === 0 && posts.length > 0 && (
        <div className="text-center py-16">
          <p className="text-muted-foreground">No posts in this category yet.</p>
        </div>
      )}
    </>
  )
}

interface CardProps {
  post: Post
  categoryLabel: string
}

interface PostCardProps extends CardProps {
  index: number
}

function FeaturedCard({ post, categoryLabel }: CardProps) {
  const formattedDate = new Date(post.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const imageInfo = getImageInfo(post.image)

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block relative overflow-hidden rounded-2xl border border-border bg-card hover:border-primary/50 transition-all duration-300 opacity-0 animate-fade-in-up"
      style={{ animationFillMode: 'forwards' }}
      aria-label={`Read article: ${post.title}`}
    >
      <div className="flex flex-col lg:flex-row">
        {/* Cover Image */}
        {imageInfo.url && (
          <div className="relative w-full lg:w-1/2 aspect-video lg:aspect-21/9 overflow-hidden">
            <Image
              src={imageInfo.url}
              alt={imageInfo.alt || post.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-linear-to-t from-card/80 via-transparent to-transparent lg:bg-linear-to-r lg:from-transparent lg:via-transparent lg:to-card" />
          </div>
        )}

        {/* Content */}
        <div
          className={`p-8 md:p-10 flex flex-col justify-center ${imageInfo.url ? 'lg:w-1/2' : 'w-full'}`}
        >
          {/* Category & Date */}
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
              {categoryLabel}
            </span>
            <time className="text-sm text-muted-foreground">{formattedDate}</time>
          </div>

          {/* Title */}
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4 group-hover:text-primary transition-colors leading-tight">
            {post.title}
          </h2>

          {/* Excerpt */}
          {post.excerpt && (
            <p className="text-muted-foreground leading-relaxed line-clamp-3">{post.excerpt}</p>
          )}

          {/* Read more indicator */}
          <div className="mt-6 flex items-center gap-2 text-primary font-medium">
            <span>Read article</span>
            <svg
              className="w-4 h-4 group-hover:translate-x-1 transition-transform"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Decorative gradient (only when no image) */}
      {!imageInfo.url && (
        <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
      )}
    </Link>
  )
}

function PostCard({ post, categoryLabel, index }: PostCardProps) {
  const formattedDate = new Date(post.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const imageInfo = getImageInfo(post.image)

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col h-full rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 overflow-hidden opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${(index + 1) * 100}ms`, animationFillMode: 'forwards' }}
      aria-label={`Read article: ${post.title}`}
    >
      {/* Cover Image */}
      {imageInfo.url && (
        <div className="relative w-full aspect-video overflow-hidden">
          <Image
            src={imageInfo.url}
            alt={imageInfo.alt || post.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      )}

      <div className="p-5 flex flex-col flex-1">
        {/* Title */}
        <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
          {post.title}
        </h3>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 flex-1">
            {post.excerpt}
          </p>
        )}

        {/* Category & Date */}
        <div className="flex items-center justify-between gap-2 mt-auto pt-3">
          <span className="px-2.5 py-0.5 rounded-full bg-muted text-xs font-medium text-muted-foreground">
            {categoryLabel}
          </span>
          <time className="text-xs text-muted-foreground">{formattedDate}</time>
        </div>
      </div>
    </Link>
  )
}
