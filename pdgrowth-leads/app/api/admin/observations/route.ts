import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// GET /api/admin/observations?client=<slug>&overlaps_since=YYYY-MM-DD&overlaps_until=YYYY-MM-DD
// Sem overlaps_*, retorna todas (limit 200).
// Com overlaps, retorna observações cujo range se sobrepõe ao filtro.
export async function GET(req: NextRequest) {
  const client = req.nextUrl.searchParams.get("client");
  const oSince = req.nextUrl.searchParams.get("overlaps_since");
  const oUntil = req.nextUrl.searchParams.get("overlaps_until");
  const supabase = createServiceClient();

  let q = supabase
    .from("report_observations")
    .select("id, client_slug, since, until, content, created_at, updated_at")
    .order("since", { ascending: false });

  if (client && client !== "all") q = q.eq("client_slug", client);
  if (oSince) q = q.or(`until.is.null,until.gte.${oSince}`);
  if (oUntil) q = q.lte("since", oUntil);
  if (!oSince && !oUntil) q = q.limit(200);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST /api/admin/observations
// Body: { client_slug, since, until?, content }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { client_slug, since, until, content } = body ?? {};
  if (!client_slug || !since || !content) {
    return NextResponse.json({ error: "client_slug, since e content são obrigatórios" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("report_observations")
    .insert({ client_slug, since, until: until ?? null, content })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// PATCH /api/admin/observations?id=<id>
// Body: { since?, until?, content? }
export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const body = await req.json();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("since" in body) update.since = body.since;
  if ("until" in body) update.until = body.until;
  if ("content" in body) update.content = body.content;
  const supabase = createServiceClient();
  const { error } = await supabase.from("report_observations").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/observations?id=<id>
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const supabase = createServiceClient();
  const { error } = await supabase.from("report_observations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
