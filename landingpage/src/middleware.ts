import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') || ''
  const pathname = url.pathname

  // Redirect www to non-www (canonical domain)
  // This is a backup redirect in case Cloudflare redirect rules don't catch it
  if (hostname.startsWith('www.')) {
    url.hostname = hostname.replace(/^www\./, '')
    return NextResponse.redirect(url, 301) // Permanent redirect
  }

  // Normalize trailing slashes - remove trailing slash except for root
  // This prevents duplicate content issues (e.g., /pricing vs /pricing/)
  if (pathname !== '/' && pathname.endsWith('/')) {
    url.pathname = pathname.slice(0, -1)
    return NextResponse.redirect(url, 301) // Permanent redirect
  }

  const response = NextResponse.next()

  // Set X-Robots-Tag header for public pages
  // Admin and API routes are already blocked in robots.txt
  response.headers.set(
    'X-Robots-Tag',
    'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  )

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
