import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; stepId: string } }) {
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (typeof body?.name === "string") patch.name = body.name;
  if (typeof body?.type === "string" && ["sales","bump","upsell","downsell","thanks","custom"].includes(body.type)) {
    patch.type = body.type;
  }
  const supabase = createServiceClient();
  const { error } = await supabase.from("funis_steps").update(patch)
    .eq("id", params.stepId).eq("funnel_id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; stepId: string } }) {
  const supabase = createServiceClient();
  // Bloqueia exclusão do step de entrada (ordem=1)
  const { data: step } = await supabase.from("funis_steps")
    .select("ordem").eq("id", params.stepId).eq("funnel_id", params.id).maybeSingle();
  if ((step as any)?.ordem === 1) {
    return NextResponse.json({ error: "step de entrada nao pode ser removido" }, { status: 400 });
  }
  const { error } = await supabase.from("funis_steps").delete()
    .eq("id", params.stepId).eq("funnel_id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
