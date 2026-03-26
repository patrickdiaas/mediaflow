import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// Debug endpoint — REMOVE IN PRODUCTION
// Usage: GET /api/debug/sales?client=amplainstituto
export async function GET(req: NextRequest) {
  const client = req.nextUrl.searchParams.get("client") ?? "amplainstituto";

  const supabase = createServiceClient();

  const [{ data: tracked }, { data: sales }] = await Promise.all([
    supabase
      .from("tracked_products")
      .select("product_id, product_name, gateway, client_slug, active")
      .eq("client_slug", client),
    supabase
      .from("sales")
      .select("id, gateway_order_id, product_id, amount, status, sale_type, client_slug, created_at")
      .eq("client_slug", client)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // Also fetch without client filter to see what client_slugs actually exist
  const { data: allSlugs } = await supabase
    .from("sales")
    .select("client_slug, gateway, status, amount, product_id, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: allTracked } = await supabase
    .from("tracked_products")
    .select("client_slug, gateway, product_id, product_name, active")
    .order("first_seen", { ascending: false })
    .limit(10);

  return NextResponse.json({
    queried_client: client,
    tracked_products_for_client: tracked ?? [],
    sales_for_client: sales ?? [],
    all_recent_sales_any_client: allSlugs ?? [],
    all_recent_tracked_products: allTracked ?? [],
  }, { status: 200 });
}
