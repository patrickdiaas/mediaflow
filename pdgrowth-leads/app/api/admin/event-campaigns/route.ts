import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// GET /api/admin/event-campaigns?client=<slug>
export async function GET(req: NextRequest) {
  const client = req.nextUrl.searchParams.get("client");
  const supabase = createServiceClient();
  const q = supabase
    .from("event_to_campaign")
    .select("id, client_slug, conversion_event, target_campaign_name, notes, created_at")
    .order("created_at", { ascending: false });
  const { data, error } = await (client && client !== "all" ? q.eq("client_slug", client) : q);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST /api/admin/event-campaigns — upsert por (client_slug, conversion_event)
// Body: { client_slug, conversion_event, target_campaign_name, notes? }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { client_slug, conversion_event, target_campaign_name, notes } = body ?? {};
  if (!client_slug || !conversion_event || !target_campaign_name) {
    return NextResponse.json({ error: "client_slug, conversion_event e target_campaign_name são obrigatórios" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("event_to_campaign")
    .upsert(
      { client_slug, conversion_event, target_campaign_name, notes: notes ?? null },
      { onConflict: "client_slug,conversion_event" }
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE /api/admin/event-campaigns?id=<id>
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const supabase = createServiceClient();
  const { error } = await supabase.from("event_to_campaign").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
