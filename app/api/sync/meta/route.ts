import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { fetchMetaCampaigns, fetchMetaAds } from '@/lib/meta-ads'

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (!process.env.META_SYNC_SECRET || secret !== process.env.META_SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accountId = process.env.META_AD_ACCOUNT_ID
  const accessToken = process.env.META_ACCESS_TOKEN

  if (!accountId || !accessToken) {
    return NextResponse.json(
      { error: 'META_AD_ACCOUNT_ID e META_ACCESS_TOKEN não configurados' },
      { status: 500 }
    )
  }

  const supabase = createServiceClient()

  // 1. Fetch campaigns from Meta
  let campaigns
  try {
    campaigns = await fetchMetaCampaigns(accountId, accessToken)
  } catch (err) {
    return NextResponse.json(
      { error: 'Falha ao buscar campanhas da Meta', details: String(err) },
      { status: 502 }
    )
  }

  // 2. Upsert campaigns into Supabase
  const { error: campaignError } = await supabase
    .from('campaigns')
    .upsert(
      campaigns.map(c => ({
        external_id: c.external_id,
        platform: c.platform,
        mode: c.mode,
        nome: c.nome,
        status: c.status,
        investimento: c.investimento,
        impressoes: c.impressoes,
        cliques: c.cliques,
        ctr: c.ctr,
        cpc: c.cpc,
        leads: c.leads,
        cpl: c.cpl,
        vendas: c.vendas,
        roas: c.roas,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: 'external_id,platform' }
    )

  if (campaignError) {
    return NextResponse.json(
      { error: 'Falha ao salvar campanhas', details: campaignError.message },
      { status: 500 }
    )
  }

  // 3. Fetch campaign UUIDs from DB to link creatives
  const campaignModeMap = new Map(campaigns.map(c => [c.external_id, c.mode]))
  const { data: dbCampaigns } = await supabase
    .from('campaigns')
    .select('id, external_id')
    .eq('platform', 'meta')
  const campaignIdMap = new Map(dbCampaigns?.map(c => [c.external_id, c.id]) ?? [])

  // 4. Fetch ads from Meta
  let ads
  try {
    ads = await fetchMetaAds(accountId, accessToken, campaignModeMap)
  } catch (err) {
    return NextResponse.json(
      { error: 'Falha ao buscar anúncios da Meta', details: String(err) },
      { status: 502 }
    )
  }

  // 5. Upsert creatives into Supabase
  const { error: creativeError } = await supabase
    .from('creatives')
    .upsert(
      ads.map(ad => ({
        external_id: ad.external_id,
        platform: ad.platform,
        mode: ad.mode,
        nome: ad.nome,
        tipo: ad.tipo,
        campaign_id: campaignIdMap.get(ad.campaign_external_id) ?? null,
        campanha: ad.campanha,
        impressoes: ad.impressoes,
        cliques: ad.cliques,
        ctr: ad.ctr,
        leads: ad.leads,
        cpl: ad.cpl,
        gasto: ad.gasto,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: 'external_id,platform' }
    )

  if (creativeError) {
    return NextResponse.json(
      { error: 'Falha ao salvar criativos', details: creativeError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    campaigns: campaigns.length,
    creatives: ads.length,
    synced_at: new Date().toISOString(),
  })
}
