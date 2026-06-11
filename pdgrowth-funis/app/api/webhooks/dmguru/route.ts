import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { validateWebhookSecret } from "@/lib/webhook-auth";
import { attributionFromDMGuru } from "@/lib/attribution";

export const runtime = "nodejs";

// Configurar no DMGuru: Settings → Integrations → Webhooks
// URL: https://funis.seu-dominio.com.br/api/webhooks/dmguru?secret=YOUR_SECRET

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!validateWebhookSecret(secret, process.env.DMGURU_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const statusMap: Record<string, string> = {
    approved: "approved", refunded: "refunded", chargeback: "chargeback",
    waiting:  "pending",  cancelled: "cancelled",
  };

  const saleType =
    body?.is_order_bump === 1 || body?.is_order_bump === true ? "order_bump"
    : body?.sale_type === "upsell" ? "upsell"
    : "main";

  const rawStatus    = String(body?.status ?? "").toLowerCase();
  const mappedStatus = statusMap[rawStatus] ?? "pending";
  const amount       = Number(body?.payment?.total ?? body?.payment?.gross ?? 0);
  const amountNet    = body?.payment?.net != null ? Number(body.payment.net) : null;

  // Atribuição: extrai visitor_id, variant_id e funnel_slug do payload
  const attr = attributionFromDMGuru(body);

  // Resolve funnel_id pelo slug (se veio) ou pela variant (se veio)
  const supabase = createServiceClient();
  let funnelId: string | null = null;

  if (attr.funnel_slug) {
    const { data } = await supabase
      .from("funis_funnels").select("id").eq("slug", attr.funnel_slug).maybeSingle();
    funnelId = data?.id ?? null;
  }
  if (!funnelId && attr.variant_id) {
    const { data } = await supabase
      .from("funis_variants")
      .select("funnel_steps:funis_steps!inner(funnel_id)")
      .eq("id", attr.variant_id)
      .maybeSingle();
    funnelId = (data as any)?.funnel_steps?.funnel_id ?? null;
  }

  const { error } = await supabase.from("funis_purchases").upsert({
    funnel_id:        funnelId,
    variant_id:       attr.variant_id,
    visitor_id:       attr.visitor_id,
    gateway:          "dmguru",
    gateway_order_id: String(body?.id ?? ""),
    status:           mappedStatus,
    sale_type:        saleType,
    product_id:       String(body?.product?.id ?? body?.items?.[0]?.id ?? ""),
    product_name:     body?.product?.name ?? body?.items?.[0]?.name ?? null,
    amount,
    amount_net:       amountNet,
    payment_method:   body?.payment?.method ?? null,
    buyer_email:      body?.contact?.email ?? null,
    buyer_name:       body?.contact?.name ?? null,
    utm_source:       body?.source?.utm_source ?? null,
    utm_campaign:     body?.source?.utm_campaign ?? null,
    approved_at:      body?.dates?.confirmed_at ?? null,
    raw_payload:      body,
  }, { onConflict: "gateway,gateway_order_id" });

  if (error) {
    console.error("[dmguru webhook]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Loga evento de compra também (pra timeline do visitor)
  if (attr.visitor_id && attr.variant_id && funnelId && mappedStatus === "approved") {
    await supabase.from("funis_events").insert({
      funnel_id:  funnelId,
      variant_id: attr.variant_id,
      visitor_id: attr.visitor_id,
      type:       saleType === "main" ? "purchase" : "purchase_" + saleType,
      value:      amount,
      meta:       { gateway: "dmguru", order_id: String(body?.id ?? "") },
    });
  }

  return NextResponse.json({ ok: true, attributed: !!attr.visitor_id });
}
