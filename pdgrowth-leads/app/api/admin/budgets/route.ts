import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// GET /api/admin/budgets?client=<slug>&year_month=YYYY-MM
// Retorna orçamentos do cliente. Sem year_month, retorna últimos 12.
export async function GET(req: NextRequest) {
  const client     = req.nextUrl.searchParams.get("client");
  const yearMonth  = req.nextUrl.searchParams.get("year_month");
  const supabase = createServiceClient();

  let q = supabase
    .from("client_budgets")
    .select("id, client_slug, year_month, platform, budget, front_half_pct, notes, updated_at")
    .order("year_month", { ascending: false })
    .order("platform", { ascending: true });

  if (client && client !== "all") q = q.eq("client_slug", client);
  if (yearMonth) q = q.eq("year_month", yearMonth);
  if (!yearMonth) q = q.limit(60);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST /api/admin/budgets — upsert por (client_slug, year_month, platform)
// Body: { client_slug, year_month, platform, budget, front_half_pct, notes? }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { client_slug, year_month, platform, budget, front_half_pct, notes } = body ?? {};
  if (!client_slug || !year_month || !platform || budget == null) {
    return NextResponse.json({ error: "client_slug, year_month, platform e budget são obrigatórios" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}$/.test(year_month)) {
    return NextResponse.json({ error: "year_month deve ser YYYY-MM" }, { status: 400 });
  }
  if (!["meta", "google", "total"].includes(platform)) {
    return NextResponse.json({ error: "platform deve ser meta, google ou total" }, { status: 400 });
  }
  const fhp = front_half_pct == null ? 50 : Number(front_half_pct);
  if (Number.isNaN(fhp) || fhp < 0 || fhp > 100) {
    return NextResponse.json({ error: "front_half_pct deve ser 0..100" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("client_budgets")
    .upsert(
      {
        client_slug,
        year_month,
        platform,
        budget: Number(budget),
        front_half_pct: fhp,
        notes: notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_slug,year_month,platform" },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE /api/admin/budgets?id=<id>
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const supabase = createServiceClient();
  const { error } = await supabase.from("client_budgets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
