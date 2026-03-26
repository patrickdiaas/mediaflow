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
  };

  const clientSlug = req.nextUrl.searchParams.get("client") ?? "unknown";

  const supabase = createServiceClient();
  const { error } = await supabase.from("sales").upsert({
    client_slug:      clientSlug,
    gateway:          "dmguru",
    gateway_order_id: String(sale?.id ?? sale?.order_id ?? ""),
    status:           statusMap[sale?.status] ?? "pending",
    product_id:       String(sale?.product?.id ?? ""),
    product_name:     sale?.product?.name ?? null,
    plan_name:        sale?.product?.plan ?? null,
    amount:           Number(sale?.value ?? sale?.amount ?? 0),
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

  return NextResponse.json({ ok: true });
}
