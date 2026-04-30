import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// GET /api/admin/aliases?client=<slug>
// Retorna aliases do cliente. Sem ?client retorna todos.
export async function GET(req: NextRequest) {
  const client = req.nextUrl.searchParams.get("client");
  const supabase = createServiceClient();
  const q = supabase
    .from("campaign_aliases")
    .select("id, client_slug, alias_utm_campaign, target_campaign_name, notes, created_at")
    .order("created_at", { ascending: false });
  const { data, error } = await (client && client !== "all" ? q.eq("client_slug", client) : q);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST /api/admin/aliases — cria ou atualiza alias por (client_slug, alias_utm_campaign).
// Body: { client_slug, alias_utm_campaign, target_campaign_name, notes? }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { client_slug, alias_utm_campaign, target_campaign_name, notes } = body ?? {};
  if (!client_slug || !alias_utm_campaign || !target_campaign_name) {
    return NextResponse.json({ error: "client_slug, alias_utm_campaign e target_campaign_name são obrigatórios" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("campaign_aliases")
    .upsert(
      { client_slug, alias_utm_campaign, target_campaign_name, notes: notes ?? null },
      { onConflict: "client_slug,alias_utm_campaign" }
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE /api/admin/aliases?id=<id>
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const supabase = createServiceClient();
  const { error } = await supabase.from("campaign_aliases").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
