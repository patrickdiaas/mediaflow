import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/auth-session";

// GET /api/auth/me — retorna dados da sessão atual (frontend usa pra
// filtrar sidebar/header). Sem body de request; lê cookie assinado.
export async function GET(req: NextRequest) {
  const raw = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySession(raw);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
  return NextResponse.json({
    authenticated: true,
    email: session.email,
    allowed_clients: session.ac,
    allowed_pages: session.ap,
    is_readonly: session.ro,
    is_admin: session.uid === "admin",
  });
}
