import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow static assets and internal Next.js files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('favicon.ico') ||
    pathname.includes('.png') ||
    pathname.includes('.jpg')
  ) {
    return NextResponse.next();
  }

  const invoiceMatch = pathname.match(/^\/invoice\/([^/]+)\/(.+)\/view$/);
  if (invoiceMatch) {
    const rewrittenUrl = request.nextUrl.clone();
    rewrittenUrl.pathname = `/invoice/${invoiceMatch[1]}/view`;
    rewrittenUrl.searchParams.set('invoiceToken', invoiceMatch[2]);
    return NextResponse.rewrite(rewrittenUrl);
  }

  // 2. Allow public Quotation and Invoice View Portals
  if ((pathname.startsWith('/quote/') || pathname.startsWith('/invoice/')) && pathname.endsWith('/view')) {
    return NextResponse.next();
  }

  // 3. Allow Login Page
  if (pathname === '/login') {
    return NextResponse.next();
  }

  // 4. Check for authentication cookie
  const authCookie = request.cookies.get('crm-auth');

  if (!authCookie || authCookie.value !== 'true') {
    // Redirect to login if not authenticated
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
