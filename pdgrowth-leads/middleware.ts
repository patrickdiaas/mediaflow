import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME, COOKIE_LEGACY_ADMIN } from "@/lib/auth-session";

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/webhooks", "/api/sync"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rotas públicas (webhooks, auth endpoints, login page)
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ─── Compat: cookie legado de admin (senha única do env) ─────────────
  // Continua funcionando pra não quebrar sessões existentes. Admin tem
  // acesso total sem restrição de allowed_pages/allowed_clients.
  const legacyAdmin = req.cookies.get(COOKIE_LEGACY_ADMIN)?.value;
  const adminExpected = process.env.DASHBOARD_PASSWORD;
  const isLegacyAdmin = adminExpected && legacyAdmin === adminExpected;
  if (isLegacyAdmin) return NextResponse.next();

  // ─── Sessão nova (dashboard_users + JWT-like HMAC) ───────────────────
  const raw = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySession(raw);

  if (!session) {
    // Sem sessão válida — vai pro login guardando o path original
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?from=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(loginUrl);
  }

  // Admin sintético (uid === "admin") passa sem checagem de rotas
  if (session.uid === "admin") return NextResponse.next();

  // API routes que não são endpoints de auth — deixa passar (endpoints já
  // fazem sua própria validação com service key ou secret).
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // ─── Verifica se rota está permitida ─────────────────────────────────
  // allowed_pages: ["*"] = tudo permitido, ["/", "/campanhas"] = só esses.
  // Match por prefix (ex: "/criativos" cobre "/criativos", "/criativos/xxx").
  const allowed = session.ap.includes("*") || session.ap.some(p => {
    if (p === "/") return pathname === "/";
    return pathname === p || pathname.startsWith(p + "/");
  });

  if (!allowed) {
    // Rota bloqueada → redireciona pra primeira permitida (Overview se listado)
    const fallback = session.ap.includes("/") ? "/" : (session.ap[0] ?? "/");
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = fallback;
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
