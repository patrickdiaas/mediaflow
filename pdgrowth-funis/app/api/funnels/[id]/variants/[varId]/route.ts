import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; varId: string } }) {
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (typeof body?.name === "string")            patch.name = body.name;
  if (typeof body?.destination_url === "string") patch.destination_url = body.destination_url;
  if (body?.weight != null)                      patch.weight = Math.max(0, Math.min(100, Number(body.weight)));
  if (body?.status === "active" || body?.status === "paused") patch.status = body.status;

  const supabase = createServiceClient();
  const { error } = await supabase.from("funis_variants").update(patch).eq("id", params.varId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; varId: string } }) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("funis_variants").delete().eq("id", params.varId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
