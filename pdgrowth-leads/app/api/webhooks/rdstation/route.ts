import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { validateWebhookSecret } from "@/lib/webhook-auth";

// RD Station webhook handler
// Configure in RD Station: Configurações → Integrações → Webhooks
// URL: https://leads.pdgrowth.com.br/api/webhooks/rdstation?secret=YOUR_SECRET&client=SLUG
//
// Suporta dois formatos:
// 1. Webhook de conversão RD Station (landing page / formulário RD)
// 2. Meta Lead Ads integrado via RD Station

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!validateWebhookSecret(secret, process.env.RD_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const clientSlug = req.nextUrl.searchParams.get("client") ?? "unknown";

  // RD Station webhook payload (conversão):
  // { leads: [{ id, email, name, personal_phone, company, ...
  //            first_conversion: { content: { ... }, source: "...", utm_* },
  //            last_conversion: { content: { ... }, source: "...", utm_* } }] }
  //
  // Pode vir também como objeto plano (formato mais antigo):
  // { email, name, personal_phone, company, conversion_identifier, ... }

  const supabase = createServiceClient();
  const leads = body.leads ?? [body];
  let inserted = 0;

  for (const lead of leads) {
    const email = (lead.email ?? lead.lead_email ?? "").toLowerCase().trim();
    if (!email) continue;

    // Pega UTMs da última conversão ou do topo do payload
    const conv = lead.last_conversion ?? lead.first_conversion ?? lead;
    const utmSource   = conv.utm_source   ?? conv.traffic_source ?? lead.utm_source   ?? null;
    const utmMedium   = conv.utm_medium   ?? lead.utm_medium   ?? null;
    const utmCampaign = conv.utm_campaign ?? lead.utm_campaign ?? null;
    const utmContent  = conv.utm_content  ?? lead.utm_content  ?? null;
    const utmTerm     = conv.utm_term     ?? lead.utm_term     ?? null;

    const conversionEvent = lead.conversion_identifier
      ?? conv.conversion_identifier
      ?? lead.identifier
      ?? conv.content?.identifier
      ?? "unknown";

    const landingPage = conv.content?.landing_page_url
      ?? conv.landing_page
      ?? lead.landing_page_url
      ?? null;

    // Detecta se veio de Meta Lead Form
    const source = (utmSource ?? "").toLowerCase().includes("facebook") && conversionEvent.includes("lead_ad")
      ? "meta_leadform"
      : "rdstation";

    const convertedAt = lead.converted_at
      ?? conv.created_at
      ?? lead.created_at
      ?? new Date().toISOString();

    console.log("[rdstation]", {
      clientSlug, email, conversionEvent,
      utm_medium: utmMedium,
      source,
    });

    const { error } = await supabase.from("leads").upsert({
      client_slug:      clientSlug,
      source,
      lead_email:       email,
      lead_name:        lead.name ?? lead.lead_name ?? null,
      lead_phone:       lead.personal_phone ?? lead.mobile_phone ?? lead.phone ?? null,
      lead_company:     lead.company ?? lead.company_name ?? null,
      conversion_event: conversionEvent,
      landing_page:     landingPage,
      utm_source:       utmSource,
      utm_medium:       utmMedium,
      utm_campaign:     utmCampaign,
      utm_content:      utmContent,
      utm_term:         utmTerm,
      converted_at:     convertedAt,
      raw_payload:      lead,
    }, { onConflict: "client_slug,source,lead_email,conversion_event,converted_at" });

    if (error) {
      console.error("[rdstation webhook]", error);
      continue;
    }

    inserted++;

    // Auto-registrar formulário em tracked_forms (active=false)
    if (conversionEvent && conversionEvent !== "unknown") {
      await supabase.from("tracked_forms").upsert({
        client_slug:      clientSlug,
        source,
        conversion_event: conversionEvent,
        display_name:     conversionEvent.replace(/[-_]/g, " "),
        updated_at:       new Date().toISOString(),
      }, { onConflict: "client_slug,source,conversion_event", ignoreDuplicates: true });
    }
  }

  return NextResponse.json({ ok: true, inserted });
}
