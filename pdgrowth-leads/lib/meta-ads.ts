// Meta Marketing API v21.0 — pdgrowth-leads sync client
const META_API_BASE = 'https://graph.facebook.com/v21.0'

// ─── Raw API types ─────────────────────────────────────────────────────────────

interface MetaPage<T> {
  data: T[]
  paging?: { cursors?: { after?: string }; next?: string }
}

interface MetaBMAccount {
  id: string
  name: string
  account_status: number // 1 = active
}

interface MetaCampaignInfo {
  id: string
  name: string
  status: string
  objective: string
}

interface MetaAdInfo {
  id: string
  name: string
  status: string
  adset_id: string
  campaign_id: string
  created_time?: string               // ISO timestamp da criação do anúncio na Meta
  updated_time?: string               // ISO timestamp da última edição (pausa, retomada, etc)
  effective_object_story_id?: string  // formato: pageId_postId
  creative?: {
    object_type?: string
    thumbnail_url?: string
    image_url?: string
    title?: string
    body?: string
    instagram_permalink_url?: string  // link direto para o post no Instagram
  }
}

interface MetaInsightRow {
  campaign_id?: string
  campaign_name?: string
  adset_id?: string
  adset_name?: string
  ad_id?: string
  ad_name?: string
  impressions: string
  clicks: string
  spend: string
  reach: string
  frequency?: string
  date_start: string
  actions?: { action_type: string; value: string }[]
  video_3_sec_watched_actions?: { action_type: string; value: string }[]
  video_thruplay_watched_actions?: { action_type: string; value: string }[]
}

// ─── Mapped types ──────────────────────────────────────────────────────────────

export interface BMAccount {
  id: string   // act_XXXXXXXX
  name: string
  slug: string
}

export interface MappedCampaignDay {
  client_slug: string
  platform: 'meta'
  campaign_id: string
  campaign_name: string
  status: string
  objective: string
  date: string
  impressions: number
  clicks: number
  spend: number
  reach: number
  landing_page_views: number
  lead_form_submissions: number
}

export interface MappedRegionDay {
  client_slug: string
  platform: 'meta'
  campaign_id: string
  region: string
  country_code: string
  date: string
  impressions: number
  clicks: number
  spend: number
  reach: number
}

export interface MappedAdSetDay {
  client_slug: string
  platform: 'meta'
  campaign_id: string
  campaign_name: string
  ad_set_id: string
  ad_set_name: string
  status: string
  date: string
  impressions: number
  clicks: number
  spend: number
  reach: number
}

export interface MappedAdDay {
  client_slug: string
  platform: 'meta'
  campaign_id: string
  campaign_name: string
  ad_set_id: string
  ad_set_name: string
  ad_id: string
  ad_name: string
  status: string
  creative_type: 'image' | 'video' | 'carousel' | 'collection' | null
  thumbnail_url: string | null
  thumbnail_stored_url?: string | null
  video_url: string | null
  headline: string | null
  body: string | null
  permalink_url: string | null
  date: string
  impressions: number
  clicks: number
  spend: number
  reach: number
  frequency: number | null
  video_3s_views: number | null
  video_thruplay_views: number | null
  created_at_meta: string | null
  updated_at_meta: string | null
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function normalizeAccountId(id: string): string {
  return id.startsWith('act_') ? id : `act_${id}`
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9]+/g, '')      // keep only alphanumeric
    .trim()
}

function buildUrl(path: string, params: Record<string, string>, token: string): string {
  const url = new URL(`${META_API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('access_token', token)
  return url.toString()
}

async function metaFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Meta API ${res.status}: ${JSON.stringify(err)}`)
  }
  return res.json() as Promise<T>
}

async function fetchAllPages<T>(initialUrl: string): Promise<T[]> {
  const results: T[] = []
  let url: string | undefined = initialUrl
  while (url) {
    const page: MetaPage<T> = await metaFetch<MetaPage<T>>(url)
    results.push(...page.data)
    url = page.paging?.next
  }
  return results
}

function parseNum(s: string | undefined): number {
  return s ? parseInt(s, 10) : 0
}

function parseFloat2(s: string | undefined): number {
  return s ? parseFloat(s) : 0
}

function parseVideoAction(
  actions: { action_type: string; value: string }[] | undefined
): number | null {
  if (!actions?.length) return null
  const found = actions.find(a => a.action_type === 'video_view')
  return found ? parseInt(found.value, 10) : null
}

function inferCreativeType(
  objectType?: string
): 'image' | 'video' | 'carousel' | 'collection' | null {
  if (!objectType) return null
  const t = objectType.toUpperCase()
  if (t === 'VIDEO') return 'video'
  if (t === 'SHARE') return 'carousel'
  if (t === 'COLLECTION_AD' || t === 'COLLECTION') return 'collection'
  return 'image'
}

export function getDateRange(days: number): { since: string; until: string } {
  const until = new Date()
  until.setDate(until.getDate() - 1) // yesterday — today's data is incomplete
  const since = new Date(until)
  since.setDate(since.getDate() - days + 1)
  return {
    since: since.toISOString().split('T')[0],
    until: until.toISOString().split('T')[0],
  }
}

// ─── Thumbnail caching ─────────────────────────────────────────────────────────
// URLs de thumbnail da Meta (fbcdn.net) são assinadas e expiram em horas/dias.
// Pra que PDFs exportados dias depois ainda mostrem imagens, baixamos as thumbs
// no momento do sync e guardamos no Supabase Storage (bucket 'ad-thumbnails',
// público). Idempotente: só baixa quando ad_id ainda não tem versão armazenada.

const THUMBNAIL_BUCKET = 'ad-thumbnails'
const THUMBNAIL_FETCH_TIMEOUT_MS = 10_000

async function downloadImage(url: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), THUMBNAIL_FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    const buf = await res.arrayBuffer()
    return { bytes: new Uint8Array(buf), contentType }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// Baixa a thumbnail e faz upload pro Supabase Storage. Retorna a public URL
// (ou null em caso de falha). O caller decide se persiste em ad_creatives.
export async function cacheThumbnailToStorage(
  supabase: any,
  clientSlug: string,
  adId: string,
  thumbnailUrl: string,
): Promise<string | null> {
  const img = await downloadImage(thumbnailUrl)
  if (!img) return null
  // Extensão inferida do content-type (fallback jpg)
  const ext = img.contentType.includes('png')
    ? 'png'
    : img.contentType.includes('webp')
      ? 'webp'
      : img.contentType.includes('gif')
        ? 'gif'
        : 'jpg'
  const path = `${clientSlug}/${adId}.${ext}`
  const { error } = await supabase.storage
    .from(THUMBNAIL_BUCKET)
    .upload(path, img.bytes, { contentType: img.contentType, upsert: true })
  if (error) {
    console.warn(`[meta-ads] falha ao subir thumb ${clientSlug}/${adId}: ${error.message}`)
    return null
  }
  const { data } = supabase.storage.from(THUMBNAIL_BUCKET).getPublicUrl(path)
  return data?.publicUrl ?? null
}

// Cachea thumbnails para uma lista de ads em paralelo controlado. Só baixa
// quando o ad_id ainda não tem versão armazenada (consulta ad_creatives).
// Retorna Map<ad_id, storage_public_url> apenas dos que foram cacheados agora.
export async function cacheThumbnailsForAds(
  supabase: any,
  clientSlug: string,
  ads: Array<{ ad_id: string; thumbnail_url: string | null }>,
  options: { concurrency?: number } = {},
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (ads.length === 0) return result

  // Consulta quem já tem thumbnail_stored_url (evita baixar de novo)
  const adIds = ads.map(a => a.ad_id)
  const { data: existing } = await supabase
    .from('ad_creatives')
    .select('ad_id, thumbnail_stored_url')
    .eq('client_slug', clientSlug)
    .in('ad_id', adIds)
    .not('thumbnail_stored_url', 'is', null)
  const alreadyCached = new Set((existing ?? []).map((r: any) => r.ad_id as string))

  // Deduplica por ad_id (podem vir múltiplas linhas do mesmo ad em datas
  // diferentes) e filtra os que precisam baixar
  const uniqueByAd = new Map<string, string>() // ad_id -> thumbnail_url
  for (const a of ads) {
    if (!a.thumbnail_url) continue
    if (alreadyCached.has(a.ad_id)) continue
    if (!uniqueByAd.has(a.ad_id)) uniqueByAd.set(a.ad_id, a.thumbnail_url)
  }

  const items = Array.from(uniqueByAd.entries())
  const concurrency = options.concurrency ?? 5
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const settled = await Promise.all(
      batch.map(async ([adId, url]) => {
        const stored = await cacheThumbnailToStorage(supabase, clientSlug, adId, url)
        return { adId, stored }
      })
    )
    for (const { adId, stored } of settled) {
      if (stored) result.set(adId, stored)
    }
  }
  return result
}

// ─── BM account discovery ──────────────────────────────────────────────────────

export async function fetchBMAdAccounts(bmId: string, token: string): Promise<BMAccount[]> {
  const url = buildUrl(`/${bmId}/client_ad_accounts`, {
    fields: 'id,name,account_status',
    limit: '200',
  }, token)
  const accounts = await fetchAllPages<MetaBMAccount>(url)
  return accounts
    .filter(a => a.account_status === 1) // active only
    .map(a => ({
      id: normalizeAccountId(a.id),
      name: a.name,
      slug: slugify(a.name),
    }))
}

// ─── Per-account data fetchers ─────────────────────────────────────────────────

async function fetchCampaignList(accountId: string, token: string): Promise<MetaCampaignInfo[]> {
  const url = buildUrl(`/${accountId}/campaigns`, {
    fields: 'id,name,status,objective',
    effective_status: '["ACTIVE","PAUSED"]',
    limit: '500',
  }, token)
  return fetchAllPages<MetaCampaignInfo>(url)
}

async function fetchAdList(accountId: string, token: string): Promise<MetaAdInfo[]> {
  // limit=100 e somente ACTIVE evita erro "Please reduce the amount of data"
  // em contas com muito histórico de ads pausados. Ads pausados aparecem em
  // insights mesmo sem estar neste list — perdemos apenas o enrichment de creative.
  const url = buildUrl(`/${accountId}/ads`, {
    fields: 'id,name,status,adset_id,campaign_id,created_time,updated_time,effective_object_story_id,creative{object_type,thumbnail_url,image_url,title,body,instagram_permalink_url}',
    effective_status: '["ACTIVE","PAUSED"]',
    limit: '100',
  }, token)
  return fetchAllPages<MetaAdInfo>(url)
}

async function fetchInsights(
  accountId: string,
  level: 'campaign' | 'adset' | 'ad',
  timeRange: string,
  token: string
): Promise<MetaInsightRow[]> {
  const fields = [
    'campaign_id', 'campaign_name',
    ...(level === 'adset' || level === 'ad' ? ['adset_id', 'adset_name'] : []),
    ...(level === 'ad' ? ['ad_id', 'ad_name'] : []),
    'impressions', 'clicks', 'spend', 'reach', 'frequency', 'date_start',
    ...(level === 'campaign' ? ['actions'] : []),
  ]
  const url = buildUrl(`/${accountId}/insights`, {
    level,
    fields: fields.join(','),
    time_range: timeRange,
    time_increment: '1',
    limit: '500',
  }, token)
  return fetchAllPages<MetaInsightRow>(url)
}

// ─── Placement insights ───────────────────────────────────────────────────────

interface MetaPlacementInsightRow {
  campaign_id?: string
  publisher_platform?: string
  platform_position?: string
  impressions: string
  clicks: string
  spend: string
  reach: string
  date_start: string
  actions?: { action_type: string; value: string }[]
}

export interface MappedPlacementDay {
  client_slug: string
  platform: 'meta'
  campaign_id: string
  placement: string
  date: string
  impressions: number
  clicks: number
  spend: number
  reach: number
  conversions: number
}

async function fetchPlacementInsights(
  accountId: string,
  timeRange: string,
  token: string
): Promise<MetaPlacementInsightRow[]> {
  const url = buildUrl(`/${accountId}/insights`, {
    level: 'campaign',
    fields: 'campaign_id,impressions,clicks,spend,reach,date_start,actions',
    breakdowns: 'publisher_platform,platform_position',
    time_range: timeRange,
    time_increment: '1',
    limit: '500',
  }, token)
  return fetchAllPages<MetaPlacementInsightRow>(url)
}

// ─── Region insights ──────────────────────────────────────────────────────────

interface MetaRegionInsightRow {
  campaign_id?: string
  region?: string
  country?: string
  impressions: string
  clicks: string
  spend: string
  reach: string
  date_start: string
}

async function fetchRegionInsights(
  accountId: string,
  timeRange: string,
  token: string
): Promise<MetaRegionInsightRow[]> {
  const url = buildUrl(`/${accountId}/insights`, {
    level: 'campaign',
    fields: 'campaign_id,impressions,clicks,spend,reach,date_start',
    breakdowns: 'region',
    time_range: timeRange,
    time_increment: '1',
    limit: '500',
  }, token)
  return fetchAllPages<MetaRegionInsightRow>(url)
}

// ─── Main sync function ────────────────────────────────────────────────────────

export async function syncAccountData(
  accountId: string,
  clientSlug: string,
  token: string,
  since: string,
  until: string
): Promise<{
  campaigns: MappedCampaignDay[]
  adSets: MappedAdSetDay[]
  ads: MappedAdDay[]
  regions: MappedRegionDay[]
  placements: MappedPlacementDay[]
  // Status/datas atuais de cada ad (vindo de fetchAdList) — usado para
  // atualizar linhas históricas de ad_creatives. updated_at_meta = última
  // edição na Meta (proxy da data em que foi pausado, quando status=PAUSED).
  adsInfoCurrent: { ad_id: string; status: string; created_at_meta: string | null; updated_at_meta: string | null }[]
}> {
  const normalizedId = normalizeAccountId(accountId)
  const timeRange = JSON.stringify({ since, until })

  // Fetch all data in parallel. Usamos allSettled para que falhas em chamadas
  // "opcionais" (ad list, breakdowns) não inviabilizem o sync inteiro da conta.
  // Os insights principais (campaign/adset/ad) são críticos e lançam se falharem.
  const settled = await Promise.allSettled([
    fetchCampaignList(normalizedId, token),                        // 0 — opcional (enrich status/objective)
    fetchInsights(normalizedId, 'campaign', timeRange, token),     // 1 — crítico
    fetchInsights(normalizedId, 'adset', timeRange, token),        // 2 — crítico
    fetchAdList(normalizedId, token),                              // 3 — opcional (enrich creative)
    fetchInsights(normalizedId, 'ad', timeRange, token),           // 4 — crítico
    fetchRegionInsights(normalizedId, timeRange, token),           // 5 — opcional (breakdown)
    fetchPlacementInsights(normalizedId, timeRange, token),        // 6 — opcional (breakdown)
  ])

  const unwrap = <T>(i: number, critical: boolean, fallback: T): T => {
    const r = settled[i]
    if (r.status === 'fulfilled') return r.value as T
    if (critical) throw r.reason
    console.warn(`[meta-ads] optional fetch #${i} failed for ${clientSlug} (${accountId}):`, r.reason instanceof Error ? r.reason.message : r.reason)
    return fallback
  }

  const campaignList     = unwrap<MetaCampaignInfo[]>(0, false, [])
  const campaignInsights = unwrap<MetaInsightRow[]>(1, true, [])
  const adSetInsights    = unwrap<MetaInsightRow[]>(2, true, [])
  const adList           = unwrap<MetaAdInfo[]>(3, false, [])
  const adInsights       = unwrap<MetaInsightRow[]>(4, true, [])
  const regionInsights   = unwrap<MetaRegionInsightRow[]>(5, false, [])
  const placementInsights = unwrap<MetaPlacementInsightRow[]>(6, false, [])

  const campaignMap = new Map(campaignList.map(c => [c.id, c]))
  const adMap = new Map(adList.map(ad => [ad.id, ad]))

  const campaigns: MappedCampaignDay[] = campaignInsights.map(row => {
    const info    = campaignMap.get(row.campaign_id ?? '')
    const actions = row.actions ?? []
    const findAction = (type: string) => {
      const found = actions.find(a => a.action_type === type)
      return found ? parseInt(found.value, 10) : 0
    }
    return {
      client_slug:        clientSlug,
      platform:           'meta',
      campaign_id:        row.campaign_id ?? '',
      campaign_name:      row.campaign_name ?? '',
      status:             info?.status ?? '',
      objective:          info?.objective ?? '',
      date:               row.date_start,
      impressions:        parseNum(row.impressions),
      clicks:             parseNum(row.clicks),
      spend:              parseFloat2(row.spend),
      reach:              parseNum(row.reach),
      landing_page_views:    findAction('landing_page_view'),
      lead_form_submissions: findAction('lead'),
    }
  })

  const adSets: MappedAdSetDay[] = adSetInsights.map(row => ({
    client_slug: clientSlug,
    platform: 'meta',
    campaign_id: row.campaign_id ?? '',
    campaign_name: row.campaign_name ?? '',
    ad_set_id: row.adset_id ?? '',
    ad_set_name: row.adset_name ?? '',
    status: '',
    date: row.date_start,
    impressions: parseNum(row.impressions),
    clicks: parseNum(row.clicks),
    spend: parseFloat2(row.spend),
    reach: parseNum(row.reach),
  }))

  const ads: MappedAdDay[] = adInsights.map(row => {
    const adInfo = adMap.get(row.ad_id ?? '')
    const creative = adInfo?.creative
    return {
      client_slug: clientSlug,
      platform: 'meta',
      campaign_id: row.campaign_id ?? '',
      campaign_name: row.campaign_name ?? '',
      ad_set_id: row.adset_id ?? '',
      ad_set_name: row.adset_name ?? '',
      ad_id: row.ad_id ?? '',
      ad_name: row.ad_name ?? '',
      status: adInfo?.status ?? '',
      creative_type: inferCreativeType(creative?.object_type),
      thumbnail_url: creative?.thumbnail_url ?? creative?.image_url ?? null,
      video_url: null,
      headline: creative?.title ?? null,
      body: creative?.body ?? null,
      permalink_url: (() => {
        // 1. Link direto do Instagram (melhor opção)
        if (creative?.instagram_permalink_url) return creative.instagram_permalink_url
        // 2. Link do post no Facebook via effective_object_story_id (pageId_postId)
        if (adInfo?.effective_object_story_id) {
          const [pageId, postId] = adInfo.effective_object_story_id.split('_')
          if (pageId && postId) return `https://www.facebook.com/permalink.php?story_fbid=${postId}&id=${pageId}`
        }
        return null
      })(),
      date: row.date_start,
      impressions: parseNum(row.impressions),
      clicks: parseNum(row.clicks),
      spend: parseFloat2(row.spend),
      reach: parseNum(row.reach),
      frequency: row.frequency ? parseFloat(row.frequency) : null,
      video_3s_views: parseVideoAction(row.video_3_sec_watched_actions),
      video_thruplay_views: parseVideoAction(row.video_thruplay_watched_actions),
      created_at_meta: adInfo?.created_time ?? null,
      updated_at_meta: adInfo?.updated_time ?? null,
    }
  })

  const regions: MappedRegionDay[] = regionInsights
    .filter(row => row.region && row.region !== 'Unknown')
    .map(row => ({
      client_slug:  clientSlug,
      platform:     'meta',
      campaign_id:  row.campaign_id ?? '',
      region:       row.region ?? '',
      country_code: row.country ?? 'BR',
      date:         row.date_start,
      impressions:  parseNum(row.impressions),
      clicks:       parseNum(row.clicks),
      spend:        parseFloat2(row.spend),
      reach:        parseNum(row.reach),
    }))

  const placements: MappedPlacementDay[] = placementInsights
    .filter(row => row.publisher_platform || row.platform_position)
    .map(row => {
      const pub = row.publisher_platform ?? ''
      const pos = row.platform_position ?? ''
      const placement = pos ? `${pub}_${pos}` : pub
      const actions = row.actions ?? []
      const leadAction = actions.find(a => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped')
      const conversions = leadAction ? parseInt(leadAction.value, 10) : 0
      return {
        client_slug:  clientSlug,
        platform:     'meta',
        campaign_id:  row.campaign_id ?? '',
        placement,
        date:         row.date_start,
        impressions:  parseNum(row.impressions),
        clicks:       parseNum(row.clicks),
        spend:        parseFloat2(row.spend),
        reach:        parseNum(row.reach),
        conversions,
      }
    })

  const adsInfoCurrent = adList.map(a => ({
    ad_id: a.id,
    status: a.status,
    created_at_meta: a.created_time ?? null,
    updated_at_meta: a.updated_time ?? null,
  }))

  return { campaigns, adSets, ads, regions, placements, adsInfoCurrent }
}
