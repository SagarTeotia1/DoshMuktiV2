import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login'];

// UX gate only — cookie presence, not validity. Real authorization is
// Backend's verifyAdmin on every API call; a forged/expired cookie here
// just gets a 401 from Backend and the app redirects client-side.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get('dosh_admin_token')?.value;
  if (!token) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
