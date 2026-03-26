import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// Hotmart webhook handler
// Configure in Hotmart: Tools → Webhooks → Add Webhook
// URL: https://vendas.pdgrowth.com.br/api/webhooks/hotmart?secret=YOUR_SECRET
// Events: PURCHASE_APPROVED, PURCHASE_REFUNDED, PURCHASE_CHARGEBACK, PURCHASE_CANCELLED

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.HOTMART_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Hotmart payload shape:
  // { event, data: { purchase: { transaction, status, price: { value }, payment: { type } },
  //                  product: { id, name },
  //                  buyer: { name, email },
  //                  tracking: { source_sck, ... } } }
  const data     = body?.data ?? {};
  const purchase = data?.purchase ?? {};
  const product  = data?.product ?? {};
  const buyer    = data?.buyer ?? {};
  const tracking = data?.tracking ?? {};

  const statusMap: Record<string, string> = {
    APPROVED:   "approved",
    COMPLETE:   "approved",
    REFUNDED:   "refunded",
    CHARGEBACK: "chargeback",
    CANCELLED:  "cancelled",
    DELAYED:    "pending",
  };

  // Hotmart identifies order bumps via purchase.is_order_bump or event ORDER_BUMP_PURCHASE
  const saleType = purchase?.is_order_bump === true || body?.event === "ORDER_BUMP_PURCHASE"
    ? "order_bump"
    : body?.event === "PURCHASE_UPSELL" ? "upsell"
    : "main";

  const clientSlug = req.nextUrl.searchParams.get("client") ?? "unknown";

  const supabase = createServiceClient();
  const { error } = await supabase.from("sales").upsert({
    client_slug:      clientSlug,
    gateway:          "hotmart",
    gateway_order_id: String(purchase?.transaction ?? ""),
    status:           statusMap[purchase?.status ?? body?.event] ?? "pending",
    sale_type:        saleType,
    product_id:       String(product?.id ?? ""),
    product_name:     product?.name ?? null,
    plan_name:        purchase?.offer?.code ?? null,
    amount:           Number(purchase?.price?.value ?? 0),
    payment_method:   purchase?.payment?.type?.toLowerCase() ?? null,
    buyer_name:       buyer?.name ?? null,
    buyer_email:      buyer?.email ?? null,
    buyer_phone:      buyer?.phone ?? null,
    utm_source:       tracking?.source_sck ?? null,
    utm_medium:       null,
    utm_campaign:     tracking?.external_reference ?? null,
    utm_content:      null,
    utm_term:         null,
    approved_at:      purchase?.approved_date
      ? new Date(purchase.approved_date).toISOString()
      : null,
    raw_payload: body,
  }, { onConflict: "gateway,gateway_order_id" });

  if (error) {
    console.error("[hotmart webhook]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Auto-registrar produto na tabela tracked_products (active=false por padrão)
  const productId = String(product?.id ?? "");
  if (productId) {
    await supabase.from("tracked_products").upsert({
      client_slug:  clientSlug,
      gateway:      "hotmart",
      product_id:   productId,
      product_name: product?.name ?? null,
      updated_at:   new Date().toISOString(),
    }, { onConflict: "client_slug,gateway,product_id", ignoreDuplicates: true });
  }

  return NextResponse.json({ ok: true });
}
