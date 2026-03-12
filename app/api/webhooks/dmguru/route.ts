import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// Payload enviado pelo Digital Manager Guru
interface DMGuruPayload {
  event: string;    // "purchase.approved" | "purchase.refunded"
  data: {
    id: string;
    status: string;
    total: number;
    product?: {
      id?: string;
      name?: string;
    };
    customer?: {
      name?: string;
      email?: string;
      phone?: string;
    };
    tracking?: {
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      utm_content?: string;
      utm_term?: string;
    };
    created_at?: string;
    [key: string]: unknown;
  };
}

const ACCEPTED_EVENTS = new Set(["purchase.approved", "purchase.refunded"]);

function inferPlatform(source?: string): "meta" | "google" | "other" {
  if (!source) return "other";
  const s = source.toLowerCase();
  if (s === "facebook" || s === "instagram" || s === "meta") return "meta";
  if (s === "google" || s === "google-ads") return "google";
  return "other";
}

function mapStatus(event: string): "approved" | "refunded" {
  return event === "purchase.refunded" ? "refunded" : "approved";
}

export async function POST(request: NextRequest) {
  try {
    // Validação do secret via query param
    const secret = request.nextUrl.searchParams.get("secret");
    if (secret !== process.env.DMGURU_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Identificador do cliente (ex: ?client=techcorp)
    const client = request.nextUrl.searchParams.get("client") ?? null;

    const body: DMGuruPayload = await request.json();

    if (!ACCEPTED_EVENTS.has(body.event)) {
      return NextResponse.json({ received: true, skipped: true });
    }

    const d = body.data;
    const tracking = d.tracking ?? {};
    const supabase = createServiceClient();

    const { error } = await supabase.from("sales").upsert(
      {
        order_id: d.id,
        status: mapStatus(body.event),
        product_id: d.product?.id ?? null,
        product_name: d.product?.name ?? null,
        total_value: d.total,
        customer_name: d.customer?.name ?? null,
        customer_email: d.customer?.email ?? null,
        customer_phone: d.customer?.phone ?? null,
        utm_source: tracking.utm_source ?? null,
        utm_medium: tracking.utm_medium ?? null,
        utm_campaign: tracking.utm_campaign ?? null,
        utm_content: tracking.utm_content ?? null,
        utm_term: tracking.utm_term ?? null,
        platform: inferPlatform(tracking.utm_source),
        client,
        raw_payload: body,
      },
      { onConflict: "order_id" } // idempotência: upsert por order_id
    );

    if (error) {
      console.error("[dmguru webhook] Supabase error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[dmguru webhook] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
