import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// GET /api/admin/campaign-groups?client=<slug>
export async function GET(req: NextRequest) {
  const client = req.nextUrl.searchParams.get("client");
  const supabase = createServiceClient();
  const q = supabase
    .from("campaign_budget_groups")
    .select("id, client_slug, campaign_name, group_name, notes, created_at")
    .order("created_at", { ascending: false });
  const { data, error } = await (client && client !== "all" ? q.eq("client_slug", client) : q);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST /api/admin/campaign-groups — upsert por (client_slug, campaign_name)
// Body: { client_slug, campaign_name, group_name, notes? }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { client_slug, campaign_name, group_name, notes } = body ?? {};
  if (!client_slug || !campaign_name || !group_name) {
    return NextResponse.json({ error: "client_slug, campaign_name e group_name são obrigatórios" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("campaign_budget_groups")
    .upsert(
      { client_slug, campaign_name, group_name, notes: notes ?? null },
      { onConflict: "client_slug,campaign_name" }
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE /api/admin/campaign-groups?id=<id>
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const supabase = createServiceClient();
  const { error } = await supabase.from("campaign_budget_groups").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
