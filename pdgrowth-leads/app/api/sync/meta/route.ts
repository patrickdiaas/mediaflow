// POST /api/sync/meta?secret=<META_SYNC_SECRET>&days=30
//
// Fluxo:
//   1. Descobre contas via Business Manager (GET /{bm_id}/client_ad_accounts)
//   2. Upsert de clientes na tabela `clients` (slug gerado pelo nome da conta)
//   3. Para cada cliente com meta_ad_account_id:
//      - Busca insights de campanhas, conjuntos e anúncios (granularidade diária)
//   4. Upsert em ad_campaigns, ad_sets e ad_creatives
//
// Protegido por META_SYNC_SECRET via query param `?secret=`.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import {
  syncAccountData,
  getDateRange,
} from '@/lib/meta-ads'

const UPSERT_BATCH = 200 // Supabase upsert batch size

async function upsertBatched<T extends object>(
  supabase: ReturnType<typeof createServiceClient>,
  table: string,
  rows: T[],
  onConflict: string
): Promise<string | null> {
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH)
    const { error } = await supabase.from(table).upsert(batch, { onConflict })
    if (error) return error.message
  }
  return null
}

export async function GET(request: Request) {
  return POST(request)
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (!process.env.META_SYNC_SECRET || secret !== process.env.META_SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = process.env.META_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'META_ACCESS_TOKEN não configurado' }, { status: 500 })
  }

  const days = Math.min(parseInt(searchParams.get('days') ?? '30', 10), 90)
  const { since, until } = getDateRange(days)
  const supabase = createServiceClient()

  // ── 1. NÃO auto-criar clientes da BM ────────────────────────────────────────
  // No dashboard de leads, os clientes são cadastrados manualmente.
  // O sync só busca dados para clientes já existentes e ativos.

  // ── 2. Buscar todos os clientes ativos com conta Meta ─────────────────────────
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('slug, name, meta_ad_account_id')
    .eq('active', true)
    .not('meta_ad_account_id', 'is', null)

  if (clientsError) {
    return NextResponse.json(
      { error: 'Falha ao buscar clientes', details: clientsError.message },
      { status: 500 }
    )
  }

  if (!clients || clients.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'Nenhum cliente com meta_ad_account_id encontrado.',
      since,
      until,
    })
  }

  // ── 3. Sincronizar dados por conta ────────────────────────────────────────────
  const results: Record<string, { campaigns: number; adSets: number; ads: number; regions: number; error?: string }> = {}

  for (const client of clients) {
    const accountId = client.meta_ad_account_id as string
    const clientSlug = client.slug as string

    let syncData
    try {
      syncData = await syncAccountData(accountId, clientSlug, token, since, until)
    } catch (err) {
      results[clientSlug] = { campaigns: 0, adSets: 0, ads: 0, regions: 0, error: String(err) }
      continue
    }

    const { campaigns, adSets, ads, regions } = syncData

    if (campaigns.length > 0) {
      const err = await upsertBatched(supabase, 'ad_campaigns', campaigns, 'platform,campaign_id,date')
      if (err) { results[clientSlug] = { campaigns: 0, adSets: 0, ads: 0, regions: 0, error: `campaigns: ${err}` }; continue }
    }

    if (adSets.length > 0) {
      const err = await upsertBatched(supabase, 'ad_sets', adSets, 'platform,ad_set_id,date')
      if (err) { results[clientSlug] = { campaigns: campaigns.length, adSets: 0, ads: 0, regions: 0, error: `ad_sets: ${err}` }; continue }
    }

    if (ads.length > 0) {
      const err = await upsertBatched(supabase, 'ad_creatives', ads, 'platform,ad_id,date')
      if (err) { results[clientSlug] = { campaigns: campaigns.length, adSets: adSets.length, ads: 0, regions: 0, error: `ad_creatives: ${err}` }; continue }
    }

    if (regions.length > 0) {
      const err = await upsertBatched(supabase, 'ad_regions', regions, 'platform,campaign_id,region,date')
      if (err) { results[clientSlug] = { campaigns: campaigns.length, adSets: adSets.length, ads: ads.length, regions: 0, error: `ad_regions: ${err}` }; continue }
    }

    results[clientSlug] = {
      campaigns: campaigns.length,
      adSets: adSets.length,
      ads: ads.length,
      regions: regions.length,
    }
  }

  const totalCampaigns = Object.values(results).reduce((s, r) => s + r.campaigns, 0)
  const totalAdSets = Object.values(results).reduce((s, r) => s + r.adSets, 0)
  const totalAds = Object.values(results).reduce((s, r) => s + r.ads, 0)
  const totalRegions = Object.values(results).reduce((s, r) => s + r.regions, 0)
  const errors = Object.entries(results)
    .filter(([, r]) => r.error)
    .map(([slug, r]) => ({ slug, error: r.error }))

  return NextResponse.json({
    success: errors.length === 0,
    since,
    until,
    clients_synced: clients.length,
    total: { campaigns: totalCampaigns, ad_sets: totalAdSets, ads: totalAds, regions: totalRegions },
    per_client: results,
    ...(errors.length > 0 && { errors }),
  })
}
