// Meta Marketing API v21.0 — pdgrowth-vendas sync client
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
  creative?: {
    object_type?: string
    thumbnail_url?: string
    image_url?: string
    title?: string
    body?: string
    permalink_url?: string
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
  const url = buildUrl(`/${accountId}/ads`, {
    fields: 'id,name,status,adset_id,campaign_id,creative{object_type,thumbnail_url,image_url,title,body}',
    effective_status: '["ACTIVE","PAUSED"]',
    limit: '500',
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
    ...(level === 'ad' ? ['video_3_sec_watched_actions', 'video_thruplay_watched_actions'] : []),
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
}> {
  const normalizedId = normalizeAccountId(accountId)
  const timeRange = JSON.stringify({ since, until })

  // Fetch all data in parallel to minimize latency
  const [campaignList, campaignInsights, adSetInsights, adList, adInsights] = await Promise.all([
    fetchCampaignList(normalizedId, token),
    fetchInsights(normalizedId, 'campaign', timeRange, token),
    fetchInsights(normalizedId, 'adset', timeRange, token),
    fetchAdList(normalizedId, token),
    fetchInsights(normalizedId, 'ad', timeRange, token),
  ])

  const campaignMap = new Map(campaignList.map(c => [c.id, c]))
  const adMap = new Map(adList.map(ad => [ad.id, ad]))

  const campaigns: MappedCampaignDay[] = campaignInsights.map(row => {
    const info = campaignMap.get(row.campaign_id ?? '')
    return {
      client_slug: clientSlug,
      platform: 'meta',
      campaign_id: row.campaign_id ?? '',
      campaign_name: row.campaign_name ?? '',
      status: info?.status ?? '',
      objective: info?.objective ?? '',
      date: row.date_start,
      impressions: parseNum(row.impressions),
      clicks: parseNum(row.clicks),
      spend: parseFloat2(row.spend),
      reach: parseNum(row.reach),
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
      permalink_url: creative?.permalink_url ?? null,
      date: row.date_start,
      impressions: parseNum(row.impressions),
      clicks: parseNum(row.clicks),
      spend: parseFloat2(row.spend),
      reach: parseNum(row.reach),
      frequency: row.frequency ? parseFloat(row.frequency) : null,
      video_3s_views: parseVideoAction(row.video_3_sec_watched_actions),
      video_thruplay_views: parseVideoAction(row.video_thruplay_watched_actions),
    }
  })

  return { campaigns, adSets, ads }
}
