import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const type = String(body?.type ?? "");
  const name = String(body?.name ?? "").trim();
  if (!["sales","bump","upsell","downsell","thanks","custom"].includes(type)) {
    return NextResponse.json({ error: "type invalido" }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "name obrigatorio" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: maxRow } = await supabase
    .from("funis_steps").select("ordem").eq("funnel_id", params.id)
    .order("ordem", { ascending: false }).limit(1).maybeSingle();
  const next = ((maxRow as any)?.ordem ?? 0) + 1;

  const { data, error } = await supabase
    .from("funis_steps")
    .insert({ funnel_id: params.id, ordem: next, type, name })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ step: data });
}
