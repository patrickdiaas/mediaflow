import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// GET /api/admin/creative-notes?client=<slug>
export async function GET(req: NextRequest) {
  const client = req.nextUrl.searchParams.get("client");
  const supabase = createServiceClient();
  const q = supabase
    .from("creative_notes")
    .select("id, client_slug, ad_id, ad_name, note, created_at, updated_at")
    .order("updated_at", { ascending: false });
  const { data, error } = await (client && client !== "all" ? q.eq("client_slug", client) : q);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST /api/admin/creative-notes — upsert por (client_slug, ad_id)
// Body: { client_slug, ad_id, ad_name?, note }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { client_slug, ad_id, ad_name, note } = body ?? {};
  if (!client_slug || !ad_id || note == null) {
    return NextResponse.json({ error: "client_slug, ad_id e note são obrigatórios" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("creative_notes")
    .upsert(
      { client_slug, ad_id, ad_name: ad_name ?? null, note, updated_at: new Date().toISOString() },
      { onConflict: "client_slug,ad_id" },
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE /api/admin/creative-notes?id=<id>
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const supabase = createServiceClient();
  const { error } = await supabase.from("creative_notes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
