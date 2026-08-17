import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { verifySession, hashPassword, SESSION_COOKIE_NAME, COOKIE_LEGACY_ADMIN } from "@/lib/auth-session";

// Endpoints de gestão de usuários — SÓ ADMIN pode chamar.
// Admin = cookie legado (senha env) OU sessão com uid === "admin".

function requireAdmin(req: NextRequest): { ok: true } | { ok: false; res: NextResponse } {
  // Cookie legado (senha admin do env)
  const legacy = req.cookies.get(COOKIE_LEGACY_ADMIN)?.value;
  const expected = process.env.DASHBOARD_PASSWORD;
  if (expected && legacy === expected) return { ok: true };

  // Cookie novo com sessão admin
  const raw = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySession(raw);
  if (session && session.uid === "admin") return { ok: true };

  return { ok: false, res: NextResponse.json({ error: "Apenas admin pode gerenciar usuários." }, { status: 403 }) };
}

// GET /api/admin/users — lista todos os usuários (sem hash de senha)
export async function GET(req: NextRequest) {
  const gate = requireAdmin(req);
  if (!gate.ok) return gate.res;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("dashboard_users")
    .select("id, email, display_name, allowed_clients, allowed_pages, is_readonly, active, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST /api/admin/users — cria ou atualiza usuário.
// Body: { email, password?, display_name?, allowed_clients[], allowed_pages[], is_readonly, active }
// Se password vazio em UPDATE, mantém a hash existente.
export async function POST(req: NextRequest) {
  const gate = requireAdmin(req);
  if (!gate.ok) return gate.res;

  const body = await req.json();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const display_name = body.display_name ?? null;
  const allowed_clients: string[] = Array.isArray(body.allowed_clients) ? body.allowed_clients : [];
  const allowed_pages: string[] = Array.isArray(body.allowed_pages) ? body.allowed_pages : [];
  const is_readonly = body.is_readonly !== false; // default true
  const active = body.active !== false;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email inválido." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verifica se já existe
  const { data: existing } = await supabase
    .from("dashboard_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  const update: Record<string, unknown> = {
    email,
    display_name,
    allowed_clients,
    allowed_pages,
    is_readonly,
    active,
    updated_at: new Date().toISOString(),
  };

  if (password) {
    update.password_hash = hashPassword(password);
  } else if (!existing) {
    return NextResponse.json({ error: "Senha obrigatória ao criar usuário novo." }, { status: 400 });
  }

  if (existing) {
    const { error } = await supabase.from("dashboard_users").update(update).eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: existing.id, action: "updated" });
  }

  const { data, error } = await supabase
    .from("dashboard_users")
    .insert(update)
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id, action: "created" });
}

// DELETE /api/admin/users?id=<uuid>
export async function DELETE(req: NextRequest) {
  const gate = requireAdmin(req);
  if (!gate.ok) return gate.res;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const supabase = createServiceClient();
  const { error } = await supabase.from("dashboard_users").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
