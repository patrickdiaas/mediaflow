// POST /api/sync/meta-leads?secret=<META_SYNC_SECRET>&days=30
//
// Puxa duas fontes de leads do Meta e popula a tabela `leads`:
//   1. Instant Forms (source='meta_leadform') — via /{form_id}/leads
//   2. Conversas iniciadas em ads Click-to-WhatsApp (source='meta_whatsapp') —
//      via insights ad-level (onsite_conversion.messaging_conversation_started_7d).
//
// Idempotente: upsert com onConflict (client_slug, source, lead_email, conversion_event, converted_at).
// Pra WhatsApp, lead_email é determinístico (`wpp_${ad_id}_${date}_${idx}`).

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { syncMetaLeadsForAccount, syncMetaWhatsappForAccount } from "@/lib/meta-leads";

const UPSERT_BATCH = 200;

export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (!process.env.META_SYNC_SECRET || secret !== process.env.META_SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "META_ACCESS_TOKEN não configurado" }, { status: 500 });
  }

  const days = Math.min(parseInt(searchParams.get("days") ?? "7", 10), 90);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceISO = since.toISOString();
  const untilISO = new Date().toISOString();

  const supabase = createServiceClient();

  const { data: clients, error: clientsErr } = await supabase
    .from("clients")
    .select("slug, name, meta_ad_account_id, syncs_whatsapp")
    .eq("active", true)
    .not("meta_ad_account_id", "is", null);

  if (clientsErr) {
    return NextResponse.json({ error: "Falha ao buscar clientes", details: clientsErr.message }, { status: 500 });
  }
  if (!clients || clients.length === 0) {
    return NextResponse.json({ success: true, message: "Nenhum cliente com meta_ad_account_id.", since: sinceISO });
  }

  interface PerClientResult {
    leadform: { forms: number; formsOk: number; formsFailed: number; leadsFound: number; leadsInserted: number; error?: string; formErrors?: { form_id: string; form_name: string; error: string }[] };
    whatsapp: { adsScanned: number; conversationsTotal: number; leadsInserted: number; skipped?: string; error?: string };
  }
  const results: Record<string, PerClientResult> = {};

  async function upsertLeads(leads: ReturnType<typeof syncMetaLeadsForAccount> extends Promise<infer R> ? (R extends { leads: infer L } ? L : never) : never): Promise<{ inserted: number; error?: string }> {
    let inserted = 0;
    for (let i = 0; i < leads.length; i += UPSERT_BATCH) {
      const batch = leads.slice(i, i + UPSERT_BATCH);
      const { error, count } = await supabase
        .from("leads")
        .upsert(batch, { onConflict: "client_slug,source,lead_email,conversion_event,converted_at", count: "exact" });
      if (error) return { inserted, error: error.message };
      inserted += count ?? batch.length;
    }
    return { inserted };
  }

  for (const client of clients) {
    const accountId = client.meta_ad_account_id as string;
    const clientSlug = client.slug as string;
    const perClient: PerClientResult = {
      leadform: { forms: 0, formsOk: 0, formsFailed: 0, leadsFound: 0, leadsInserted: 0 },
      whatsapp: { adsScanned: 0, conversationsTotal: 0, leadsInserted: 0 },
    };

    // ── 1. Lead Forms ────────────────────────────────────────────────────────
    try {
      const lf = await syncMetaLeadsForAccount(accountId, clientSlug, token, sinceISO);
      perClient.leadform.forms = lf.forms;
      perClient.leadform.formsOk = lf.formsOk;
      perClient.leadform.formsFailed = lf.formsFailed;
      perClient.leadform.leadsFound = lf.leads.length;
      if (lf.errors.length) perClient.leadform.formErrors = lf.errors;
      if (lf.leads.length > 0) {
        const up = await upsertLeads(lf.leads);
        perClient.leadform.leadsInserted = up.inserted;
        if (up.error) perClient.leadform.error = `upsert: ${up.error}`;
      }
    } catch (err) {
      perClient.leadform.error = String(err);
    }

    // ── 2. Click-to-WhatsApp (opt-in por cliente via clients.syncs_whatsapp) ──
    //    Sem opt-in explícito, a Meta às vezes reporta conversation_started em
    //    ads não-CtW e polui clientes que rodam só LP tradicional.
    if (!(client as any).syncs_whatsapp) {
      perClient.whatsapp.skipped = "cliente não tem syncs_whatsapp=true";
    } else {
      try {
        const wp = await syncMetaWhatsappForAccount(accountId, clientSlug, token, sinceISO, untilISO);
        perClient.whatsapp.adsScanned = wp.adsScanned;
        perClient.whatsapp.conversationsTotal = wp.conversationsTotal;
        if (wp.leads.length > 0) {
          const up = await upsertLeads(wp.leads);
          perClient.whatsapp.leadsInserted = up.inserted;
          if (up.error) perClient.whatsapp.error = `upsert: ${up.error}`;
        }
      } catch (err) {
        perClient.whatsapp.error = String(err);
      }
    }

    results[clientSlug] = perClient;
  }

  return NextResponse.json({ success: true, since: sinceISO, until: untilISO, days, results });
}
