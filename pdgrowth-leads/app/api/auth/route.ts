import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import {
  signSession,
  adminSessionData,
  SESSION_COOKIE_NAME,
  COOKIE_LEGACY_ADMIN,
} from "@/lib/auth-session";
import { verifyPassword } from "@/lib/auth-password";

// POST /api/auth
// Body: { email?: string, password: string }
// - Se email vazio E password bate com DASHBOARD_PASSWORD → sessão admin (compat)
// - Se email preenchido → valida contra dashboard_users no Supabase
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!password) {
    return NextResponse.json({ error: "Senha obrigatória." }, { status: 400 });
  }

  // ─── Caminho 1: sem email → tenta senha admin do env (compat)
  if (!email) {
    const expected = process.env.DASHBOARD_PASSWORD;
    if (!expected) {
      return NextResponse.json({ error: "Senha admin não configurada." }, { status: 500 });
    }
    const valid =
      password.length === expected.length &&
      Buffer.from(password).equals(Buffer.from(expected));
    if (!valid) {
      await new Promise(r => setTimeout(r, 500)); // slow down brute force
      return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true, role: "admin" });
    // Cookie legado admin (mantém compat com URLs/checagens antigas)
    res.cookies.set(COOKIE_LEGACY_ADMIN, expected, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    // Cookie novo com dados de sessão admin
    res.cookies.set(SESSION_COOKIE_NAME, await signSession(adminSessionData()), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }

  // ─── Caminho 2: email preenchido → valida dashboard_users
  const supabase = createServiceClient();
  const { data: user, error } = await supabase
    .from("dashboard_users")
    .select("id, email, password_hash, display_name, allowed_clients, allowed_pages, is_readonly, active")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("[/api/auth] supabase error:", error.message);
    return NextResponse.json({ error: "Erro ao validar credenciais." }, { status: 500 });
  }

  if (!user || !user.active) {
    await new Promise(r => setTimeout(r, 500));
    return NextResponse.json({ error: "Email ou senha incorretos." }, { status: 401 });
  }

  if (!verifyPassword(password, user.password_hash)) {
    await new Promise(r => setTimeout(r, 500));
    return NextResponse.json({ error: "Email ou senha incorretos." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, role: user.is_readonly ? "readonly" : "user" });
  res.cookies.set(SESSION_COOKIE_NAME, await signSession({
    uid: user.id,
    email: user.email,
    ac: user.allowed_clients ?? [],
    ap: user.allowed_pages ?? [],
    ro: user.is_readonly,
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
