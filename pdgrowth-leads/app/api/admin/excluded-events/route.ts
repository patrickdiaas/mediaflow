import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// GET /api/admin/excluded-events
export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("excluded_conversion_events")
    .select("id, conversion_event, reason, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST /api/admin/excluded-events — upsert por conversion_event
// Body: { conversion_event, reason? }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { conversion_event, reason } = body ?? {};
  if (!conversion_event) {
    return NextResponse.json({ error: "conversion_event é obrigatório" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("excluded_conversion_events")
    .upsert({ conversion_event, reason: reason ?? null }, { onConflict: "conversion_event" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE /api/admin/excluded-events?id=<id>
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const supabase = createServiceClient();
  const { error } = await supabase.from("excluded_conversion_events").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
