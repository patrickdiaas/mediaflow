import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/webhooks", "/api/sync"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow webhooks and auth endpoints without password
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check auth cookie
  const auth = req.cookies.get("pdg_auth")?.value;
  const expected = process.env.DASHBOARD_PASSWORD;

  if (!expected) {
    // No password configured → allow (misconfiguration safety)
    return NextResponse.next();
  }

  if (auth !== expected) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?from=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
