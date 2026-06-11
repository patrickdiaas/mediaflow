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
    .from("funis_clients")
    .select("id, name, slug, created_at")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clients: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const supabase = createServiceClient();

  // Usa a primeira account (MVP single-tenant)
  const { data: account } = await supabase.from("funis_accounts").select("id").limit(1).maybeSingle();
  if (!account) return NextResponse.json({ error: "no account" }, { status: 500 });

  const { data, error } = await supabase
    .from("funis_clients")
    .insert({ account_id: account.id, name, slug: slugify(name) })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ client: data });
}
