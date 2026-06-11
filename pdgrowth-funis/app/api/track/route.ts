import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "bad json" }, { status: 400, headers: CORS }); }

  const visitor = String(body?.mfv ?? "");
  const variant = String(body?.mfvar ?? "");
  const slug    = String(body?.mfs ?? "");
  const type    = String(body?.type ?? "").slice(0, 64);

  if (!UUID_RE.test(visitor) || !UUID_RE.test(variant) || !type) {
    return NextResponse.json({ error: "missing ids" }, { status: 400, headers: CORS });
  }

  const supabase = createServiceClient();

  // Resolve funnel_id e step_id default a partir da variant (1 query, barato)
  const { data: ctx } = await supabase
    .from("funis_variants")
    .select("step_id, funnel_steps:funis_steps!inner(funnel_id)")
    .eq("id", variant)
    .maybeSingle();

  let stepId    = (ctx as any)?.step_id ?? null;
  const funnelId = (ctx as any)?.funnel_steps?.funnel_id ?? null;
  if (!funnelId) {
    return NextResponse.json({ error: "unknown variant" }, { status: 404, headers: CORS });
  }

  // Se o pixel mandou step (data-step="bump" ou nome), resolve pra step_id
  // certo dentro do mesmo funil (pode ser diferente do step de origem da variant).
  const stepHint = typeof body?.step === "string" ? body.step.trim() : null;
  if (stepHint) {
    const { data: stepRow } = await supabase
      .from("funis_steps")
      .select("id")
      .eq("funnel_id", funnelId)
      .or(`type.eq.${stepHint},name.ilike.${stepHint}`)
      .order("ordem")
      .limit(1)
      .maybeSingle();
    if (stepRow?.id) stepId = stepRow.id;
  }

  const value =
    body?.value != null && !isNaN(Number(body.value)) ? Number(body.value) : null;

  const { error } = await supabase.from("funis_events").insert({
    funnel_id:  funnelId,
    step_id:    stepId,
    variant_id: variant,
    visitor_id: visitor,
    type,
    url:        typeof body?.url === "string" ? body.url.slice(0, 1024) : null,
    value,
    meta:       typeof body?.meta === "object" ? body.meta : null,
  });

  if (error) {
    console.error("[track]", error);
    return NextResponse.json({ error: "insert failed" }, { status: 500, headers: CORS });
  }
  return NextResponse.json({ ok: true }, { headers: CORS });
}
