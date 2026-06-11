import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

function slugify(name: string) {
  return name.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("funis_funnels")
    .select("id, name, slug, status, client_id, created_at, clients:funis_clients(name)")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ funnels: data ?? [] });
}

/**
 * POST /api/funnels — cria funil já com a primeira etapa (sales) e N variantes.
 * Body: { name, client_id, slug?, variants: [{ name, destination_url, weight }] }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const name      = String(body?.name ?? "").trim();
  const client_id = String(body?.client_id ?? "");
  const variants  = Array.isArray(body?.variants) ? body.variants : [];

  if (!name || !client_id || variants.length === 0) {
    return NextResponse.json({ error: "name, client_id, variants[] obrigatórios" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: account } = await supabase.from("funis_accounts").select("id").limit(1).maybeSingle();
  if (!account) return NextResponse.json({ error: "no account" }, { status: 500 });

  const baseSlug = body?.slug ? slugify(String(body.slug)) : slugify(name);
  // garante unicidade
  let slug = baseSlug;
  for (let i = 1; ; i++) {
    const { data: clash } = await supabase.from("funis_funnels").select("id").eq("slug", slug).maybeSingle();
    if (!clash) break;
    slug = `${baseSlug}-${i + 1}`;
  }

  // Funil
  const { data: funnel, error: fErr } = await supabase
    .from("funis_funnels")
    .insert({ account_id: account.id, client_id, name, slug })
    .select().single();
  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 });

  // Primeira etapa: sales
  const { data: step, error: sErr } = await supabase
    .from("funis_steps")
    .insert({ funnel_id: funnel.id, ordem: 1, type: "sales", name: "Página de Vendas" })
    .select().single();
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  // Variantes
  const rows = variants.map((v: any) => ({
    step_id: step.id,
    name: String(v?.name ?? "Variante").slice(0, 80),
    destination_url: String(v?.destination_url ?? ""),
    weight: Math.max(0, Math.min(100, Number(v?.weight ?? 50))),
  })).filter((v: any) => v.destination_url);

  if (rows.length === 0) {
    return NextResponse.json({ error: "ao menos uma variante com URL" }, { status: 400 });
  }

  const { error: vErr } = await supabase.from("funis_variants").insert(rows);
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });

  return NextResponse.json({ funnel });
}
