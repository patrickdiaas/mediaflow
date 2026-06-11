import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const step_id = String(body?.step_id ?? "");
  const name    = String(body?.name ?? "Nova").slice(0, 80);
  const url     = String(body?.destination_url ?? "");
  const weight  = Math.max(0, Math.min(100, Number(body?.weight ?? 0)));
  if (!step_id) return NextResponse.json({ error: "step_id obrigatorio" }, { status: 400 });

  const supabase = createServiceClient();
  // confirma que o step pertence ao funil
  const { data: step } = await supabase.from("funis_steps")
    .select("id, type").eq("id", step_id).eq("funnel_id", params.id).maybeSingle();
  if (!step) return NextResponse.json({ error: "step nao encontrado" }, { status: 404 });

  // destination_url é obrigatório só pra step type='sales'
  if ((step as any).type === "sales" && !url) {
    return NextResponse.json({ error: "destination_url obrigatorio em step sales" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("funis_variants")
    .insert({ step_id, name, destination_url: url, weight })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ variant: data });
}
