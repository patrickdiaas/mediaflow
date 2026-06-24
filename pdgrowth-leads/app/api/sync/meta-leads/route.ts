// POST /api/sync/meta-leads?secret=<META_SYNC_SECRET>&days=30
//
// Puxa leads do Meta Lead Ads (Instant Forms) e popula a tabela `leads`.
// Usado por clientes que capturam leads direto no Meta (sem RD Station no meio).
//
// Roda em todos os clientes ativos com meta_ad_account_id.
// Idempotente: upsert com onConflict (client_slug, source, lead_email, conversion_event, converted_at).

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { syncMetaLeadsForAccount } from "@/lib/meta-leads";

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

  const supabase = createServiceClient();

  const { data: clients, error: clientsErr } = await supabase
    .from("clients")
    .select("slug, name, meta_ad_account_id")
    .eq("active", true)
    .not("meta_ad_account_id", "is", null);

  if (clientsErr) {
    return NextResponse.json({ error: "Falha ao buscar clientes", details: clientsErr.message }, { status: 500 });
  }
  if (!clients || clients.length === 0) {
    return NextResponse.json({ success: true, message: "Nenhum cliente com meta_ad_account_id.", since: sinceISO });
  }

  const results: Record<string, { forms: number; formsOk: number; formsFailed: number; leadsFound: number; leadsInserted: number; error?: string }> = {};

  for (const client of clients) {
    const accountId = client.meta_ad_account_id as string;
    const clientSlug = client.slug as string;

    let sync;
    try {
      sync = await syncMetaLeadsForAccount(accountId, clientSlug, token, sinceISO);
    } catch (err) {
      results[clientSlug] = { forms: 0, formsOk: 0, formsFailed: 0, leadsFound: 0, leadsInserted: 0, error: String(err) };
      continue;
    }

    let inserted = 0;
    let upsertError: string | undefined;
    if (sync.leads.length > 0) {
      for (let i = 0; i < sync.leads.length; i += UPSERT_BATCH) {
        const batch = sync.leads.slice(i, i + UPSERT_BATCH);
        const { error, count } = await supabase
          .from("leads")
          .upsert(batch, { onConflict: "client_slug,source,lead_email,conversion_event,converted_at", count: "exact" });
        if (error) { upsertError = error.message; break; }
        inserted += count ?? batch.length;
      }
    }

    results[clientSlug] = {
      forms: sync.forms,
      formsOk: sync.formsOk,
      formsFailed: sync.formsFailed,
      leadsFound: sync.leads.length,
      leadsInserted: inserted,
      ...(upsertError ? { error: `upsert: ${upsertError}` } : {}),
    };
  }

  return NextResponse.json({ success: true, since: sinceISO, days, results });
}
