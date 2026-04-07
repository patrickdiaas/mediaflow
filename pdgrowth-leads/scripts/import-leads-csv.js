#!/usr/bin/env node
// Importa leads de CSV exportado do RD Station para o Supabase
// Uso: node scripts/import-leads-csv.js <caminho-csv> <client-slug>

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://iilxlsjeloebwrvtgick.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY env var");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- CSV parser simples que lida com campos com aspas e quebras de linha ---
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || (c === "\r" && text[i + 1] === "\n")) {
        row.push(field);
        field = "";
        if (row.length > 1) rows.push(row);
        row = [];
        if (c === "\r") i++;
      } else {
        field += c;
      }
    }
  }
  if (field || row.length) {
    row.push(field);
    if (row.length > 1) rows.push(row);
  }
  return rows;
}

async function main() {
  const csvPath = process.argv[2];
  const clientSlug = process.argv[3];

  if (!csvPath || !clientSlug) {
    console.error("Uso: node scripts/import-leads-csv.js <csv> <client-slug>");
    process.exit(1);
  }

  console.log(`Lendo ${csvPath}...`);
  const raw = fs.readFileSync(path.resolve(csvPath), "utf-8");
  const allRows = parseCSV(raw);
  const headers = allRows[0];
  const dataRows = allRows.slice(1);

  console.log(`${dataRows.length} linhas encontradas, ${headers.length} colunas`);

  // Mapeia índices das colunas relevantes
  const col = (name) => {
    const i = headers.findIndex(
      (h) => h.trim().toLowerCase() === name.toLowerCase()
    );
    return i;
  };

  const iDate = col("Data da Conversão");
  const iEmail = col("Email");
  const iEvent = col("Identificador");
  const iName = col("Nome");
  const iPhone = col("Celular");
  const iUrl = col("URL da Conversão");

  // UTMs — RD exporta com nomes variados
  const iUtmSource = col("utm_source");
  const iUtmMedium = col("utm_medium");
  const iUtmCampaign = col("utm_campaign");
  const iUtmTerm = col("utm_term");
  // utm_content geralmente está em "UTM Content" ou "UTM Content Real"
  const iUtmContent =
    col("UTM Content Real") !== -1
      ? col("UTM Content Real")
      : col("UTM Content");

  console.log("Índices:", {
    iDate, iEmail, iEvent, iName, iPhone,
    iUtmSource, iUtmMedium, iUtmCampaign, iUtmContent, iUtmTerm,
  });

  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  const batch = [];

  for (const row of dataRows) {
    const email = (row[iEmail] || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      skipped++;
      continue;
    }

    const dateStr = (row[iDate] || "").trim();
    // Formato RD: "2026-03-02 11:11:18 -0300"
    let convertedAt = null;
    if (dateStr) {
      // Converte para ISO
      const match = dateStr.match(
        /(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{4})/
      );
      if (match) {
        convertedAt = `${match[1]}T${match[2]}${match[3].slice(0, 3)}:${match[3].slice(3)}`;
      }
    }

    const conversionEvent = (row[iEvent] || "").trim() || null;
    const utmSource = iUtmSource >= 0 ? (row[iUtmSource] || "").trim() || null : null;
    const utmMedium = iUtmMedium >= 0 ? (row[iUtmMedium] || "").trim() || null : null;
    const utmCampaign = iUtmCampaign >= 0 ? (row[iUtmCampaign] || "").trim() || null : null;
    const utmContent = iUtmContent >= 0 ? (row[iUtmContent] || "").trim() || null : null;
    const utmTerm = iUtmTerm >= 0 ? (row[iUtmTerm] || "").trim() || null : null;

    batch.push({
      client_slug: clientSlug,
      source: "rdstation",
      lead_email: email,
      lead_name: (row[iName] || "").trim() || null,
      lead_phone: iPhone >= 0 ? (row[iPhone] || "").trim() || null : null,
      conversion_event: conversionEvent,
      landing_page: iUrl >= 0 ? (row[iUrl] || "").trim() || null : null,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm,
      converted_at: convertedAt,
    });
  }

  console.log(`Processados: ${batch.length} leads válidos, ${skipped} pulados`);

  // Insere em batches de 200
  const BATCH_SIZE = 200;
  for (let i = 0; i < batch.length; i += BATCH_SIZE) {
    const chunk = batch.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("leads")
      .upsert(chunk, {
        onConflict: "client_slug,source,lead_email,conversion_event,converted_at",
      });

    if (error) {
      console.error(`Erro no batch ${i}-${i + chunk.length}:`, error.message);
      errors += chunk.length;
    } else {
      inserted += chunk.length;
      process.stdout.write(`\r  Inseridos: ${inserted}/${batch.length}`);
    }
  }

  console.log(`\n\nResumo:`);
  console.log(`  Total no CSV: ${dataRows.length}`);
  console.log(`  Inseridos: ${inserted}`);
  console.log(`  Pulados (sem email): ${skipped}`);
  console.log(`  Erros: ${errors}`);

  // Auto-registra eventos em tracked_forms
  const events = new Set(batch.map((l) => l.conversion_event).filter(Boolean));
  console.log(`\n  Formulários únicos: ${events.size}`);
  for (const evt of events) {
    await supabase.from("tracked_forms").upsert(
      {
        client_slug: clientSlug,
        source: "rdstation",
        conversion_event: evt,
        display_name: evt.replace(/[-_]/g, " "),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_slug,source,conversion_event", ignoreDuplicates: true }
    );
  }
  console.log("  Formulários registrados em tracked_forms ✓");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
