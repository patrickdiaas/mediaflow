#!/usr/bin/env node
// Backfill UTMs para leads que vieram pelo webhook mas ficaram sem UTMs
// porque o webhook antigo não extraía de conversion_origin/traffic_source.
//
// Uso: node scripts/backfill-webhook-utms.js
//
// Requer NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local

const fs = require("fs");
const envFile = fs.readFileSync(".env.local", "utf-8");
for (const line of envFile.split("\n")) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
}
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function decodeTrafficSource(ts) {
  if (!ts || !ts.startsWith("encoded_")) return {};
  try {
    const decoded = Buffer.from(ts.slice(8), "base64").toString("utf-8");
    const parsed = JSON.parse(decoded);
    const sessionValue = parsed.current_session?.value ?? parsed.first_session?.value ?? "";
    if (!sessionValue) return {};
    const params = new URLSearchParams(sessionValue);
    const result = {};
    for (const [key, value] of params.entries()) {
      if (key.startsWith("utm_")) result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

async function main() {
  // Busca leads com raw_payload (vieram pelo webhook)
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, lead_email, conversion_event, utm_source, utm_medium, utm_campaign, utm_content, utm_term, raw_payload")
    .not("raw_payload", "is", null)
    .order("created_at", { ascending: false });

  if (error) { console.error("Erro ao buscar leads:", error); return; }
  console.log(`Total leads com raw_payload: ${leads.length}`);

  let updated = 0;
  let skipped = 0;

  for (const lead of leads) {
    const payload = lead.raw_payload;
    const conv = payload.last_conversion ?? payload.first_conversion ?? {};
    const origin = conv.conversion_origin ?? {};
    const trafficSource = conv.content?.traffic_source ?? conv.traffic_source ?? "";
    const tsUtms = decodeTrafficSource(trafficSource);

    // Extrair UTMs
    const utmSource   = tsUtms.utm_source   ?? origin.source   ?? null;
    const utmMedium   = tsUtms.utm_medium   ?? origin.medium   ?? null;
    const utmCampaign = tsUtms.utm_campaign ?? origin.campaign ?? null;
    const utmContent  = tsUtms.utm_content  ?? origin.value    ?? null;
    const utmTerm     = tsUtms.utm_term     ?? null;

    // Normalizar
    const normalizedSource = utmSource ? utmSource.toLowerCase() : null;
    const normalizedMedium = utmMedium && utmMedium !== "unknown" ? utmMedium.toLowerCase() : null;

    // Conversion identifier
    const conversionEvent = conv.content?.conversion_identifier
      ?? conv.content?.identificador
      ?? conv.source
      ?? "unknown";

    // Verificar se precisa atualizar
    const needsUpdate =
      (lead.conversion_event === "unknown" && conversionEvent !== "unknown") ||
      (!lead.utm_source && normalizedSource) ||
      (!lead.utm_medium && normalizedMedium) ||
      (!lead.utm_campaign && utmCampaign) ||
      (!lead.utm_content && utmContent) ||
      (!lead.utm_term && utmTerm);

    if (!needsUpdate) { skipped++; continue; }

    const updates = {};
    if (lead.conversion_event === "unknown" && conversionEvent !== "unknown") updates.conversion_event = conversionEvent;
    if (!lead.utm_source && normalizedSource) updates.utm_source = normalizedSource;
    if (!lead.utm_medium && normalizedMedium) updates.utm_medium = normalizedMedium;
    if (!lead.utm_campaign && utmCampaign) updates.utm_campaign = utmCampaign;
    if (!lead.utm_content && utmContent) updates.utm_content = utmContent;
    if (!lead.utm_term && utmTerm) updates.utm_term = utmTerm;

    const { error: updErr } = await supabase
      .from("leads")
      .update(updates)
      .eq("id", lead.id);

    if (updErr) {
      console.error(`Erro ao atualizar ${lead.lead_email}:`, updErr);
      continue;
    }

    console.log(`✓ ${lead.lead_email} → ${JSON.stringify(updates)}`);
    updated++;
  }

  console.log(`\nResultado: ${updated} atualizados, ${skipped} sem alteração`);
}

main();
