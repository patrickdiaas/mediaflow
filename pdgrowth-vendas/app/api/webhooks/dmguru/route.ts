import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { validateWebhookSecret } from "@/lib/webhook-auth";

// Digital Manager Guru webhook handler
// Configure in DMGuru: Settings → Integrations → Webhooks
// URL: https://vendas.pdgrowth.com.br/api/webhooks/dmguru?secret=YOUR_SECRET

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!validateWebhookSecret(secret, process.env.DMGURU_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // DMGuru payload: o body inteiro é a transação (não tem wrapper "sale")
  // Estrutura real: { id, status, product: { id, name }, payment: { total, method },
  //                   source: { utm_* }, contact: { name, email }, is_order_bump, dates: { confirmed_at } }

  const statusMap: Record<string, string> = {
    approved:   "approved",
    refunded:   "refunded",
    chargeback: "chargeback",
    waiting:    "pending",
    cancelled:  "cancelled",
  };

  const saleType = body?.is_order_bump === 1 || body?.is_order_bump === true ? "order_bump"
    : body?.sale_type === "upsell" ? "upsell"
    : "main";

  const amount      = Number(body?.payment?.total ?? body?.payment?.gross ?? 0);
  const amountNet   = body?.payment?.net != null ? Number(body.payment.net) : null;
  const gatewayFee  = body?.payment?.marketplace_value != null ? Number(body.payment.marketplace_value) : null;
  const rawStatus   = String(body?.status ?? "").toLowerCase();
  const mappedStatus = statusMap[rawStatus] ?? "pending";
  const productId   = String(body?.product?.id ?? body?.items?.[0]?.id ?? "");
  const productName = body?.product?.name ?? body?.items?.[0]?.name ?? null;
  const clientSlug  = req.nextUrl.searchParams.get("client") ?? "unknown";

  console.log("[dmguru] extracted:", {
    clientSlug, productId, amount,
    status: mappedStatus, saleType,
    utm_medium: body?.source?.utm_medium,
    gateway_order_id: body?.id,
  });

  const supabase = createServiceClient();
  const { error } = await supabase.from("sales").upsert({
    client_slug:      clientSlug,
    gateway:          "dmguru",
    gateway_order_id: String(body?.id ?? ""),
    status:           mappedStatus,
    sale_type:        saleType,
    product_id:       productId,
    product_name:     productName,
    plan_name:        body?.product?.offer?.name ?? null,
    amount,
    payment_method:   body?.payment?.method ?? null,
    buyer_name:       body?.contact?.name ?? null,
    buyer_email:      body?.contact?.email ?? null,
    buyer_phone:      body?.contact?.phone_number ?? null,
    utm_source:       body?.source?.utm_source ?? null,
    utm_medium:       body?.source?.utm_medium ?? null,
    utm_campaign:     body?.source?.utm_campaign ?? null,
    utm_content:      body?.source?.utm_content ?? null,
    utm_term:         body?.source?.utm_term ?? null,
    amount_net:       amountNet,
    gateway_fee:      gatewayFee,
    approved_at:      body?.dates?.confirmed_at ?? null,
    raw_payload:      body,
  }, { onConflict: "gateway,gateway_order_id" });

  if (error) {
    console.error("[dmguru webhook]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Auto-registrar produto na tabela tracked_products (active=false por padrão)
  if (productId) {
    await supabase.from("tracked_products").upsert({
      client_slug:  clientSlug,
      gateway:      "dmguru",
      product_id:   productId,
      product_name: productName,
      updated_at:   new Date().toISOString(),
    }, { onConflict: "client_slug,gateway,product_id", ignoreDuplicates: true });
  }

  return NextResponse.json({ ok: true });
}
