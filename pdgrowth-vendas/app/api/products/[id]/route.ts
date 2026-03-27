import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// PATCH /api/products/[id] — update active status and/or sheet_id
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: { active?: boolean; sheet_id?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.active !== undefined) update.active   = body.active;
  if ("sheet_id" in body)        update.sheet_id = body.sheet_id ?? null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("tracked_products")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    console.error("[products toggle]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}
