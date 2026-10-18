import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "odera_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // IMPORTANT: middleware runs in Edge runtime. Do NOT use firebase-admin here.
  if (pathname.startsWith("/dashboard")) {
    const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!cookie) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
