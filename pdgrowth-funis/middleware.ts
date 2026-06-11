import { NextRequest, NextResponse } from "next/server";

// Rotas públicas — não exigem auth. O split router /f/[slug], o pixel /p.js,
// o /api/track e os webhooks ficam abertos. O resto (admin) exige cookie.
const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth",
  "/api/webhooks",
  "/api/track",
  "/f/",
  "/p.js",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const auth = req.cookies.get("pdg_auth")?.value;
  const expected = process.env.DASHBOARD_PASSWORD;

  if (!expected) return NextResponse.next();

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
