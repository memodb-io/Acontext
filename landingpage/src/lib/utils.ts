import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Media } from '@/payload-types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get image information from Media object or Post image field
 * Handles both R2 storage and local storage
 * Returns an object with url, alt, and absoluteUrl
 */
export function getImageInfo(image: Media | number | null | undefined): {
  url: string | null
  alt: string
  absoluteUrl: string | undefined
} {
  if (!image || typeof image === 'number') {
    return { url: null, alt: '', absoluteUrl: undefined }
  }

  // Get URL - prefer R2 public URL if configured
  let url: string | null = null
  if (process.env.NEXT_PUBLIC_R2_PUBLIC_URL && image.filename) {
    url = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${image.filename}`
  } else {
    url = image.url || null
  }

  // Get alt text
  const alt = image.alt || ''

  // Get absolute URL for SEO, JSON-LD, etc.
  let absoluteUrl: string | undefined = undefined
  if (url) {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      absoluteUrl = url
    } else {
      const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://acontext.io'
      absoluteUrl = `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`
    }
  }

  return { url, alt, absoluteUrl }
}
