import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// Payload enviado pelo RD Station em conversões de formulário
interface RDStationPayload {
  event_type: string;       // "CONVERSION"
  event_family: string;     // "CDP"
  payload: {
    conversion_identifier: string;
    name?: string;
    email: string;
    mobile_phone?: string;
    personal_phone?: string;
    traffic_source?: string;
    traffic_medium?: string;
    traffic_campaign?: string;
    traffic_value?: string;   // utm_content
    traffic_term?: string;    // utm_term
    created_at?: string;
    [key: string]: unknown;
  };
}

function inferPlatform(source?: string): "meta" | "google" | "other" {
  if (!source) return "other";
  const s = source.toLowerCase();
  if (s === "facebook" || s === "instagram" || s === "meta") return "meta";
  if (s === "google" || s === "cpc" || s === "google-ads") return "google";
  return "other";
}

export async function POST(request: NextRequest) {
  try {
    // Validação do secret (RD Station envia token via query param ou header)
    const secret = request.nextUrl.searchParams.get("secret");
    if (secret !== process.env.RD_STATION_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Identificador do cliente (ex: ?client=techcorp)
    const client = request.nextUrl.searchParams.get("client") ?? null;

    const body: RDStationPayload = await request.json();

    // Aceitar apenas eventos de conversão
    if (body.event_type !== "CONVERSION") {
      return NextResponse.json({ received: true, skipped: true });
    }

    const p = body.payload;

    const supabase = createServiceClient();

    const { error } = await supabase.from("leads").insert({
      nome: p.name ?? null,
      email: p.email,
      telefone: p.mobile_phone ?? p.personal_phone ?? null,
      conversion_identifier: p.conversion_identifier,
      utm_source: p.traffic_source ?? null,
      utm_medium: p.traffic_medium ?? null,
      utm_campaign: p.traffic_campaign ?? null,
      utm_content: p.traffic_value ?? null,
      utm_term: p.traffic_term ?? null,
      platform: inferPlatform(p.traffic_source),
      client,
      raw_payload: body,
    });

    if (error) {
      console.error("[rdstation webhook] Supabase error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[rdstation webhook] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
