import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceClient();

  const { data: funnel, error } = await supabase
    .from("funis_funnels")
    .select("id, name, slug, status, client_id, notes, created_at, clients:funis_clients(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (error || !funnel) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: steps } = await supabase
    .from("funis_steps")
    .select("id, ordem, type, name")
    .eq("funnel_id", params.id)
    .order("ordem");

  const stepIds = (steps ?? []).map(s => s.id);
  const { data: variants } = stepIds.length
    ? await supabase.from("funis_variants")
        .select("id, step_id, name, destination_url, weight, status")
        .in("step_id", stepIds)
        .order("created_at")
    : { data: [] };

  return NextResponse.json({ funnel, steps: steps ?? [], variants: variants ?? [] });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (typeof body?.name === "string")   patch.name = body.name;
  if (typeof body?.status === "string") patch.status = body.status;
  if (typeof body?.notes === "string")  patch.notes = body.notes;

  const supabase = createServiceClient();
  const { error } = await supabase.from("funis_funnels").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("funis_funnels").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
