import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// Eduzz (Nutror) webhook handler
// Configure in Eduzz: Settings → Notifications → Webhooks
// URL: https://vendas.pdgrowth.com.br/api/webhooks/eduzz?secret=YOUR_SECRET
// Events: SALE_APPROVED, SALE_REFUNDED, SALE_CHARGEBACK, SALE_CANCELLED

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.EDUZZ_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Eduzz payload shape:
  // { sale_id, sale_status, sale_status_name, sale_price, sale_payment_method,
  //   client_name, client_email, client_phone,
  //   content_title, content_id,
  //   tracking_utm_source, tracking_utm_medium, tracking_utm_campaign, ... }

  const statusMap: Record<string, string> = {
    "3":  "approved",    // Paid
    "4":  "cancelled",
    "6":  "refunded",
    "7":  "chargeback",
    "9":  "pending",
    paid:       "approved",
    approved:   "approved",
    refunded:   "refunded",
    chargeback: "chargeback",
    cancelled:  "cancelled",
    waiting:    "pending",
  };

  const clientSlug = req.nextUrl.searchParams.get("client") ?? "unknown";
  const rawStatus  = body?.sale_status ?? body?.status ?? "";

  const supabase = createServiceClient();
  const { error } = await supabase.from("sales").upsert({
    client_slug:      clientSlug,
    gateway:          "eduzz",
    gateway_order_id: String(body?.sale_id ?? ""),
    status:           statusMap[String(rawStatus)] ?? "pending",
    product_id:       String(body?.content_id ?? ""),
    product_name:     body?.content_title ?? null,
    plan_name:        null,
    amount:           Number(body?.sale_price ?? 0),
    payment_method:   body?.sale_payment_method?.toLowerCase() ?? null,
    buyer_name:       body?.client_name ?? null,
    buyer_email:      body?.client_email ?? null,
    buyer_phone:      body?.client_phone ?? null,
    utm_source:       body?.tracking_utm_source ?? null,
    utm_medium:       body?.tracking_utm_medium ?? null,
    utm_campaign:     body?.tracking_utm_campaign ?? null,
    utm_content:      body?.tracking_utm_content ?? null,
    utm_term:         body?.tracking_utm_term ?? null,
    approved_at:      rawStatus === "3" || rawStatus === "paid" || rawStatus === "approved"
      ? new Date().toISOString()
      : null,
    raw_payload: body,
  }, { onConflict: "gateway,gateway_order_id" });

  if (error) {
    console.error("[eduzz webhook]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
