import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// GET /api/admin/actions?client=<slug>&since=YYYY-MM-DD&until=YYYY-MM-DD
// Retorna ações do cliente no período. Sem since/until, retorna últimas 90.
export async function GET(req: NextRequest) {
  const client = req.nextUrl.searchParams.get("client");
  const since  = req.nextUrl.searchParams.get("since");
  const until  = req.nextUrl.searchParams.get("until");
  const supabase = createServiceClient();

  let q = supabase
    .from("report_actions")
    .select("id, client_slug, action_date, platform, campaign_name, title, description, created_at")
    .order("action_date", { ascending: false });

  if (client && client !== "all") q = q.eq("client_slug", client);
  if (since) q = q.gte("action_date", since);
  if (until) q = q.lte("action_date", until);
  if (!since && !until) q = q.limit(200);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST /api/admin/actions
// Body: { client_slug, action_date, platform?, campaign_name?, title, description }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { client_slug, action_date, platform, campaign_name, title, description } = body ?? {};
  if (!client_slug || !action_date || !title || !description) {
    return NextResponse.json({ error: "client_slug, action_date, title e description são obrigatórios" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("report_actions")
    .insert({
      client_slug,
      action_date,
      platform: platform ?? null,
      campaign_name: campaign_name ?? null,
      title,
      description,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE /api/admin/actions?id=<id>
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const supabase = createServiceClient();
  const { error } = await supabase.from("report_actions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
