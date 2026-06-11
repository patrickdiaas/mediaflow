import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { validateWebhookSecret } from "@/lib/webhook-auth";
import { attributionFromHotmart } from "@/lib/attribution";

export const runtime = "nodejs";

// Configurar no Hotmart: Tools → Webhooks → Add Webhook
// URL: https://funis.seu-dominio.com.br/api/webhooks/hotmart?secret=YOUR_SECRET
// Eventos: PURCHASE_APPROVED, PURCHASE_REFUNDED, PURCHASE_CHARGEBACK,
//          PURCHASE_CANCELLED, ORDER_BUMP_PURCHASE, PURCHASE_UPSELL

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!validateWebhookSecret(secret, process.env.HOTMART_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const data     = body?.data ?? {};
  const purchase = data?.purchase ?? {};
  const product  = data?.product ?? {};
  const buyer    = data?.buyer ?? {};
  const tracking = data?.tracking ?? {};

  const statusMap: Record<string, string> = {
    APPROVED:   "approved", COMPLETE:   "approved",
    REFUNDED:   "refunded", CHARGEBACK: "chargeback",
    CANCELLED:  "cancelled", DELAYED:   "pending",
  };

  const saleType =
    purchase?.is_order_bump === true || body?.event === "ORDER_BUMP_PURCHASE" ? "order_bump"
    : body?.event === "PURCHASE_UPSELL" ? "upsell"
    : "main";

  const mappedStatus = statusMap[purchase?.status ?? body?.event] ?? "pending";
  const amount       = Number(purchase?.price?.value ?? 0);

  const attr = attributionFromHotmart(body);

  const supabase = createServiceClient();
  let funnelId: string | null = null;

  if (attr.funnel_slug) {
    const { data: f } = await supabase
      .from("funis_funnels").select("id").eq("slug", attr.funnel_slug).maybeSingle();
    funnelId = f?.id ?? null;
  }
  if (!funnelId && attr.variant_id) {
    const { data: v } = await supabase
      .from("funis_variants")
      .select("funnel_steps:funis_steps!inner(funnel_id)")
      .eq("id", attr.variant_id)
      .maybeSingle();
    funnelId = (v as any)?.funnel_steps?.funnel_id ?? null;
  }

  const { error } = await supabase.from("funis_purchases").upsert({
    funnel_id:        funnelId,
    variant_id:       attr.variant_id,
    visitor_id:       attr.visitor_id,
    gateway:          "hotmart",
    gateway_order_id: String(purchase?.transaction ?? ""),
    status:           mappedStatus,
    sale_type:        saleType,
    product_id:       String(product?.id ?? ""),
    product_name:     product?.name ?? null,
    amount,
    payment_method:   purchase?.payment?.type?.toLowerCase() ?? null,
    buyer_email:      buyer?.email ?? null,
    buyer_name:       buyer?.name ?? null,
    utm_source:       tracking?.source_sck ?? null,
    utm_campaign:     tracking?.external_reference ?? null,
    approved_at:      purchase?.approved_date
      ? new Date(purchase.approved_date).toISOString() : null,
    raw_payload:      body,
  }, { onConflict: "gateway,gateway_order_id" });

  if (error) {
    console.error("[hotmart webhook]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (attr.visitor_id && attr.variant_id && funnelId && mappedStatus === "approved") {
    await supabase.from("funis_events").insert({
      funnel_id:  funnelId,
      variant_id: attr.variant_id,
      visitor_id: attr.visitor_id,
      type:       saleType === "main" ? "purchase" : "purchase_" + saleType,
      value:      amount,
      meta:       { gateway: "hotmart", transaction: String(purchase?.transaction ?? "") },
    });
  }

  return NextResponse.json({ ok: true, attributed: !!attr.visitor_id });
}
