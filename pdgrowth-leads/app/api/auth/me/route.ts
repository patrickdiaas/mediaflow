import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME, COOKIE_LEGACY_ADMIN } from "@/lib/auth-session";

// GET /api/auth/me — retorna dados da sessão atual (frontend usa pra
// filtrar sidebar/header). Aceita cookie novo (pdg_session assinado) OU
// cookie legado admin (pdg_auth = senha do env).
export async function GET(req: NextRequest) {
  // 1) Cookie novo assinado
  const raw = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySession(raw);
  if (session) {
    return NextResponse.json({
      authenticated: true,
      email: session.email,
      allowed_clients: session.ac,
      allowed_pages: session.ap,
      is_readonly: session.ro,
      is_admin: session.uid === "admin",
    });
  }

  // 2) Fallback: cookie legado admin (senha do env). Se bate, é admin total.
  const legacy = req.cookies.get(COOKIE_LEGACY_ADMIN)?.value;
  const expected = process.env.DASHBOARD_PASSWORD;
  if (expected && legacy === expected) {
    return NextResponse.json({
      authenticated: true,
      email: "admin",
      allowed_clients: ["*"],
      allowed_pages: ["*"],
      is_readonly: false,
      is_admin: true,
    });
  }

  return NextResponse.json({ authenticated: false }, { status: 200 });
}
