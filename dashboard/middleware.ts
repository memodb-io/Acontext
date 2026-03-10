import { updateSession } from "@/lib/supabase/proxy";
import { type NextRequest, NextResponse } from "next/server";
import { isUuid, isBase64Url, uuidToBase64Url, base64UrlToUuid } from "@/lib/id-codec";

/**
 * Convert IDs in URL path from UUID to Base64URL (redirect) or vice versa (rewrite)
 *
 * Generic approach: splits path by '/', checks each segment for UUID/Base64URL format,
 * and converts accordingly. Works with any URL pattern without hardcoding routes.
 */
function convertUrlIds(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;

  // Split pathname into segments
  const segments = pathname.split('/').filter(s => s.length > 0);

  let hasUuid = false;
  let hasBase64Url = false;
  const convertedSegments = segments.map(segment => {
    if (isUuid(segment)) {
      hasUuid = true;
      return uuidToBase64Url(segment);
    } else if (isBase64Url(segment)) {
      hasBase64Url = true;
      return base64UrlToUuid(segment);
    }
    return segment;
  });

  // If we found UUIDs, redirect to Base64URL version
  if (hasUuid) {
    const newPathname = '/' + convertedSegments.join('/');
    const url = request.nextUrl.clone();
    url.pathname = newPathname;
    return NextResponse.redirect(url, 302);
  }

  // If we found Base64URLs, rewrite to UUID version (internal, no URL change)
  if (hasBase64Url) {
    const newPathname = '/' + convertedSegments.join('/');
    const url = request.nextUrl.clone();
    url.pathname = newPathname;
    return NextResponse.rewrite(url);
  }

  return null;
}

export async function middleware(request: NextRequest) {
  // First, handle ID conversion
  const idConversionResponse = convertUrlIds(request);
  if (idConversionResponse) {
    return idConversionResponse;
  }

  // Then handle session authentication
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
