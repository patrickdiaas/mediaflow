import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// Digital Manager Guru webhook handler
// Configure in DMGuru: Settings → Integrations → Webhooks
// URL: https://vendas.pdgrowth.com.br/api/webhooks/dmguru?secret=YOUR_SECRET

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.DMGURU_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // DMGuru payload shape (simplified):
  // { event, sale: { id, status, value, product: { id, name }, buyer: { name, email, phone }, tracking: { utm_* } } }
  const sale = body?.sale ?? body;

  const statusMap: Record<string, string> = {
    approved:   "approved",
    refunded:   "refunded",
    chargeback: "chargeback",
    waiting:    "pending",
    cancelled:  "cancelled",
    // uppercase variants (some DMGuru versions send uppercase)
    APPROVED:   "approved",
    REFUNDED:   "refunded",
    CHARGEBACK: "chargeback",
    WAITING:    "pending",
    CANCELLED:  "cancelled",
  };

  // DMGuru sends order_bump=true on the sale object for bump purchases
  const saleType = sale?.order_bump === true ? "order_bump"
    : sale?.sale_type === "upsell" ? "upsell"
    : "main";

  // amount: try every known field name in DMGuru payloads
  const rawAmount = sale?.value ?? sale?.amount ?? sale?.total ?? sale?.price
    ?? sale?.net_value ?? sale?.gross_value ?? 0;
  const amount = Number(rawAmount);

  // status: lowercase for safe mapping
  const rawStatus = String(sale?.status ?? "").toLowerCase();
  const mappedStatus = statusMap[sale?.status] ?? statusMap[rawStatus] ?? "pending";

  // product_id: may be number or string in DMGuru
  const productId = String(sale?.product?.id ?? sale?.product_id ?? "");

  const clientSlug = req.nextUrl.searchParams.get("client") ?? "unknown";

  // Log extracted values for debugging (visible in Vercel logs)
  console.log("[dmguru] extracted:", {
    clientSlug, productId, amount, rawAmount,
    status: mappedStatus, rawStatus: sale?.status,
    saleType, gateway_order_id: sale?.id ?? sale?.order_id,
  });

  const supabase = createServiceClient();
  const { error } = await supabase.from("sales").upsert({
    client_slug:      clientSlug,
    gateway:          "dmguru",
    gateway_order_id: String(sale?.id ?? sale?.order_id ?? ""),
    status:           mappedStatus,
    sale_type:        saleType,
    product_id:       productId,
    product_name:     sale?.product?.name ?? null,
    plan_name:        sale?.product?.plan ?? null,
    amount,
    payment_method:   sale?.payment_method ?? null,
    buyer_name:       sale?.buyer?.name ?? null,
    buyer_email:      sale?.buyer?.email ?? null,
    buyer_phone:      sale?.buyer?.phone ?? null,
    utm_source:       sale?.tracking?.utm_source ?? sale?.utm_source ?? null,
    utm_medium:       sale?.tracking?.utm_medium ?? sale?.utm_medium ?? null,
    utm_campaign:     sale?.tracking?.utm_campaign ?? sale?.utm_campaign ?? null,
    utm_content:      sale?.tracking?.utm_content ?? sale?.utm_content ?? null,
    utm_term:         sale?.tracking?.utm_term ?? sale?.utm_term ?? null,
    approved_at:      sale?.status === "approved" ? new Date().toISOString() : null,
    raw_payload:      body,
  }, { onConflict: "gateway,gateway_order_id" });

  if (error) {
    console.error("[dmguru webhook]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Auto-registrar produto na tabela tracked_products (active=false por padrão)
  const productName = sale?.product?.name ?? null;
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
