// POST /api/sync/google?secret=<GOOGLE_SYNC_SECRET>&days=30
//
// Fluxo:
//   1. Busca todos os clientes ativos com google_ads_customer_id no Supabase
//   2. Para cada cliente: busca campanhas, conjuntos, anúncios, keywords e search terms
//   3. Upsert em ad_campaigns, ad_sets, ad_creatives, keywords e search_terms
//
// Protegido por GOOGLE_SYNC_SECRET via query param `?secret=`.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import {
  getGoogleAccessToken,
  syncGoogleAdsAccount,
  getDateRange,
} from '@/lib/google-ads'

const UPSERT_BATCH = 200

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

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (!process.env.GOOGLE_SYNC_SECRET || secret !== process.env.GOOGLE_SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Valida credenciais Google antes de qualquer coisa
  let accessToken: string
  try {
    accessToken = await getGoogleAccessToken()
  } catch (err) {
    return NextResponse.json(
      { error: 'Falha ao obter access token Google', details: String(err) },
      { status: 500 }
    )
  }

  const days       = Math.min(parseInt(searchParams.get('days') ?? '30', 10), 90)
  const { since, until } = getDateRange(days)
  const supabase   = createServiceClient()
  const managerId  = process.env.GOOGLE_ADS_MANAGER_ID ?? undefined

  // Busca clientes com google_ads_customer_id
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('slug, name, google_ads_customer_id')
    .eq('active', true)
    .not('google_ads_customer_id', 'is', null)

  if (clientsError) {
    return NextResponse.json(
      { error: 'Falha ao buscar clientes', details: clientsError.message },
      { status: 500 }
    )
  }

  if (!clients || clients.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'Nenhum cliente com google_ads_customer_id encontrado.',
      since,
      until,
    })
  }

  const results: Record<string, {
    campaigns: number; adSets: number; ads: number
    keywords: number; searchTerms: number; error?: string
  }> = {}

  for (const client of clients) {
    const customerId = client.google_ads_customer_id as string
    const clientSlug = client.slug as string

    let syncData
    try {
      syncData = await syncGoogleAdsAccount(customerId, clientSlug, accessToken, since, until, managerId)
    } catch (err) {
      results[clientSlug] = { campaigns: 0, adSets: 0, ads: 0, keywords: 0, searchTerms: 0, error: String(err) }
      continue
    }

    const { campaigns, adSets, ads, keywords, searchTerms } = syncData

    // Upsert campaigns
    if (campaigns.length > 0) {
      const err = await upsertBatched(supabase, 'ad_campaigns', campaigns, 'platform,campaign_id,date')
      if (err) { results[clientSlug] = { campaigns: 0, adSets: 0, ads: 0, keywords: 0, searchTerms: 0, error: `campaigns: ${err}` }; continue }
    }

    // Upsert ad sets
    if (adSets.length > 0) {
      const err = await upsertBatched(supabase, 'ad_sets', adSets, 'platform,ad_set_id,date')
      if (err) { results[clientSlug] = { campaigns: campaigns.length, adSets: 0, ads: 0, keywords: 0, searchTerms: 0, error: `ad_sets: ${err}` }; continue }
    }

    // Upsert ads
    if (ads.length > 0) {
      const err = await upsertBatched(supabase, 'ad_creatives', ads, 'platform,ad_id,date')
      if (err) { results[clientSlug] = { campaigns: campaigns.length, adSets: adSets.length, ads: 0, keywords: 0, searchTerms: 0, error: `ad_creatives: ${err}` }; continue }
    }

    // Upsert keywords
    if (keywords.length > 0) {
      const err = await upsertBatched(supabase, 'keywords', keywords, 'client_slug,keyword_id,date')
      if (err) { results[clientSlug] = { campaigns: campaigns.length, adSets: adSets.length, ads: ads.length, keywords: 0, searchTerms: 0, error: `keywords: ${err}` }; continue }
    }

    // Upsert search terms
    if (searchTerms.length > 0) {
      const err = await upsertBatched(supabase, 'search_terms', searchTerms, 'client_slug,campaign_id,ad_group_id,search_term,date')
      if (err) { results[clientSlug] = { campaigns: campaigns.length, adSets: adSets.length, ads: ads.length, keywords: keywords.length, searchTerms: 0, error: `search_terms: ${err}` }; continue }
    }

    results[clientSlug] = {
      campaigns:   campaigns.length,
      adSets:      adSets.length,
      ads:         ads.length,
      keywords:    keywords.length,
      searchTerms: searchTerms.length,
    }
  }

  const total = {
    campaigns:   Object.values(results).reduce((s, r) => s + r.campaigns, 0),
    ad_sets:     Object.values(results).reduce((s, r) => s + r.adSets, 0),
    ads:         Object.values(results).reduce((s, r) => s + r.ads, 0),
    keywords:    Object.values(results).reduce((s, r) => s + r.keywords, 0),
    search_terms: Object.values(results).reduce((s, r) => s + r.searchTerms, 0),
  }

  const errors = Object.entries(results)
    .filter(([, r]) => r.error)
    .map(([slug, r]) => ({ slug, error: r.error }))

  return NextResponse.json({
    success: errors.length === 0,
    since,
    until,
    clients_synced: clients.length,
    total,
    per_client: results,
    ...(errors.length > 0 && { errors }),
  })
}
