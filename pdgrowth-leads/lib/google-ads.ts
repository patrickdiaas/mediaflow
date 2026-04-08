// Google Ads REST API v18 — pdgrowth-vendas sync client
//
// Autenticação: OAuth2 (client_id + client_secret + refresh_token → access_token)
// Developer token obrigatório em todas as requisições.
//
// Hierarquia: Manager Account (MCC) > Customer > Campaign > AdGroup > Ad / Keyword

const GOOGLE_ADS_API_VERSION = 'v23'
const GOOGLE_ADS_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'

// ─── Tipos internos da API ─────────────────────────────────────────────────────

interface GoogleAdsSearchResponse {
  results: GoogleAdsRow[]
  nextPageToken?: string
}

interface GoogleAdsRow {
  campaign?: {
    id: string
    name: string
    status: string
    advertisingChannelType?: string
  }
  adGroup?: {
    id: string
    name: string
    status: string
  }
  adGroupAd?: {
    ad: {
      id: string
      name?: string
      type?: string
      finalUrls?: string[]
      responsiveSearchAd?: { headlines: object[]; descriptions: object[] }
      expandedTextAd?: { headlinePart1?: string; headlinePart2?: string }
    }
    status: string
  }
  adGroupCriterion?: {
    criterionId: string
    keyword?: { text: string; matchType: string }
    status: string
  }
  searchTermView?: {
    searchTerm: string
    status: string
  }
  metrics?: {
    impressions: string
    clicks: string
    costMicros: string
    conversions?: string
  }
  segments?: {
    date: string
  }
}

// ─── Tipos exportados (mapeados para o Supabase) ──────────────────────────────

export interface MappedGoogleCampaignDay {
  client_slug: string
  platform: 'google'
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

export interface MappedGoogleAdSetDay {
  client_slug: string
  platform: 'google'
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

export interface MappedGoogleAdDay {
  client_slug: string
  platform: 'google'
  campaign_id: string
  campaign_name: string
  ad_set_id: string
  ad_set_name: string
  ad_id: string
  ad_name: string
  status: string
  creative_type: null
  thumbnail_url: null
  video_url: null
  headline: string | null
  body: null
  permalink_url: null
  date: string
  impressions: number
  clicks: number
  spend: number
  reach: number
  frequency: null
  video_3s_views: null
  video_thruplay_views: null
}

export interface MappedKeywordDay {
  client_slug: string
  platform: 'google'
  campaign_id: string
  campaign_name: string
  ad_group_id: string
  ad_group_name: string
  keyword_id: string
  keyword_text: string
  match_type: string
  status: string
  date: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
}

export interface MappedSearchTermDay {
  client_slug: string
  platform: 'google'
  campaign_id: string
  campaign_name: string
  ad_group_id: string
  ad_group_name: string
  keyword_id: string
  keyword_text: string
  search_term: string
  match_type: string
  date: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
}

// ─── OAuth2 — obter access token ───────────────────────────────────────────────

export async function getGoogleAccessToken(): Promise<string> {
  const clientId     = process.env.GOOGLE_ADS_CLIENT_ID
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Variáveis GOOGLE_ADS_CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN não configuradas')
  }

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`OAuth2 token error ${res.status}: ${JSON.stringify(err)}`)
  }

  const json = await res.json() as { access_token: string }
  return json.access_token
}

// ─── Helper: executar query GAQL com paginação ────────────────────────────────

async function googleAdsSearch(
  customerId: string,
  query: string,
  accessToken: string,
  managerId?: string
): Promise<GoogleAdsRow[]> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  if (!developerToken) throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN não configurado')

  const headers: Record<string, string> = {
    'Authorization':   `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type':    'application/json',
  }
  if (managerId) headers['login-customer-id'] = managerId.replace(/-/g, '')

  const cleanCustomerId = customerId.replace(/-/g, '')
  const url = `${GOOGLE_ADS_BASE}/customers/${cleanCustomerId}/googleAds:search`

  const rows: GoogleAdsRow[] = []
  let pageToken: string | undefined

  do {
    const body: Record<string, string> = { query }
    if (pageToken) body.pageToken = pageToken

    const res = await fetch(url, {
      method:  'POST',
      headers,
      body:    JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Google Ads API ${res.status}: ${errText}`)
    }

    const data = await res.json() as GoogleAdsSearchResponse
    if (data.results) rows.push(...data.results)
    pageToken = data.nextPageToken
  } while (pageToken)

  return rows
}

// ─── Helpers numéricos ─────────────────────────────────────────────────────────

function toInt(s: string | undefined): number {
  return s ? parseInt(s, 10) : 0
}

function microsToReal(s: string | undefined): number {
  return s ? parseFloat(s) / 1_000_000 : 0
}

// ─── Utilitários públicos ──────────────────────────────────────────────────────

export function getDateRange(days: number): { since: string; until: string } {
  const until = new Date()
  until.setDate(until.getDate() - 1)
  const since = new Date(until)
  since.setDate(since.getDate() - days + 1)
  return {
    since: since.toISOString().split('T')[0],
    until: until.toISOString().split('T')[0],
  }
}

// ─── Sync principal por conta ──────────────────────────────────────────────────

export async function syncGoogleAdsAccount(
  customerId: string,
  clientSlug: string,
  accessToken: string,
  since: string,
  until: string,
  managerId?: string
): Promise<{
  campaigns: MappedGoogleCampaignDay[]
  adSets: MappedGoogleAdSetDay[]
  ads: MappedGoogleAdDay[]
  keywords: MappedKeywordDay[]
  searchTerms: MappedSearchTermDay[]
}> {
  const dateCondition = `segments.date BETWEEN '${since}' AND '${until}'`

  // Executa todas as queries em paralelo para minimizar latência
  const [campaignRows, adGroupRows, adRows, keywordRows, searchTermRows] = await Promise.all([
    googleAdsSearch(customerId, `
      SELECT
        campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
        metrics.impressions, metrics.clicks, metrics.cost_micros,
        segments.date
      FROM campaign
      WHERE ${dateCondition}
        AND campaign.status != 'REMOVED'
    `, accessToken, managerId),

    googleAdsSearch(customerId, `
      SELECT
        ad_group.id, ad_group.name, ad_group.status,
        campaign.id, campaign.name,
        metrics.impressions, metrics.clicks, metrics.cost_micros,
        segments.date
      FROM ad_group
      WHERE ${dateCondition}
        AND campaign.status != 'REMOVED'
        AND ad_group.status != 'REMOVED'
    `, accessToken, managerId),

    googleAdsSearch(customerId, `
      SELECT
        ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type,
        ad_group_ad.ad.responsive_search_ad.headlines,
        ad_group_ad.ad.expanded_text_ad.headline_part1,
        ad_group_ad.status,
        campaign.id, campaign.name,
        ad_group.id, ad_group.name,
        metrics.impressions, metrics.clicks, metrics.cost_micros,
        segments.date
      FROM ad_group_ad
      WHERE ${dateCondition}
        AND campaign.status != 'REMOVED'
        AND ad_group.status != 'REMOVED'
        AND ad_group_ad.status != 'REMOVED'
    `, accessToken, managerId),

    googleAdsSearch(customerId, `
      SELECT
        ad_group_criterion.criterion_id,
        ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
        ad_group_criterion.status,
        campaign.id, campaign.name,
        ad_group.id, ad_group.name,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions,
        segments.date
      FROM keyword_view
      WHERE ${dateCondition}
        AND campaign.status != 'REMOVED'
        AND ad_group.status != 'REMOVED'
        AND ad_group_criterion.status != 'REMOVED'
    `, accessToken, managerId),

    googleAdsSearch(customerId, `
      SELECT
        search_term_view.search_term, search_term_view.status,
        campaign.id, campaign.name,
        ad_group.id, ad_group.name,
        ad_group_criterion.criterion_id,
        ad_group_criterion.keyword.text,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions,
        segments.date
      FROM search_term_view
      WHERE ${dateCondition}
        AND campaign.status != 'REMOVED'
        AND ad_group.status != 'REMOVED'
    `, accessToken, managerId),
  ])

  // ── Campanhas ────────────────────────────────────────────────────────────────
  const campaigns: MappedGoogleCampaignDay[] = campaignRows.map(r => ({
    client_slug:   clientSlug,
    platform:      'google',
    campaign_id:   r.campaign?.id ?? '',
    campaign_name: r.campaign?.name ?? '',
    status:        r.campaign?.status ?? '',
    objective:     r.campaign?.advertisingChannelType ?? '',
    date:          r.segments?.date ?? '',
    impressions:   toInt(r.metrics?.impressions),
    clicks:        toInt(r.metrics?.clicks),
    spend:         microsToReal(r.metrics?.costMicros),
    reach:         0, // Google Ads não fornece reach da mesma forma que Meta
  }))

  // ── Conjuntos de anúncios (Ad Groups) ────────────────────────────────────────
  const adSets: MappedGoogleAdSetDay[] = adGroupRows.map(r => ({
    client_slug:   clientSlug,
    platform:      'google',
    campaign_id:   r.campaign?.id ?? '',
    campaign_name: r.campaign?.name ?? '',
    ad_set_id:     r.adGroup?.id ?? '',
    ad_set_name:   r.adGroup?.name ?? '',
    status:        r.adGroup?.status ?? '',
    date:          r.segments?.date ?? '',
    impressions:   toInt(r.metrics?.impressions),
    clicks:        toInt(r.metrics?.clicks),
    spend:         microsToReal(r.metrics?.costMicros),
    reach:         0,
  }))

  // ── Anúncios ─────────────────────────────────────────────────────────────────
  const ads: MappedGoogleAdDay[] = adRows.map(r => {
    const ad = r.adGroupAd?.ad
    // Headline: tenta responsive search ad primeiro, depois expanded text ad
    const headline = ad?.expandedTextAd?.headlinePart1 ?? null
    return {
      client_slug:         clientSlug,
      platform:            'google',
      campaign_id:         r.campaign?.id ?? '',
      campaign_name:       r.campaign?.name ?? '',
      ad_set_id:           r.adGroup?.id ?? '',
      ad_set_name:         r.adGroup?.name ?? '',
      ad_id:               ad?.id ?? '',
      ad_name:             ad?.name ?? ad?.id ?? '',
      status:              r.adGroupAd?.status ?? '',
      creative_type:       null,
      thumbnail_url:       null,
      video_url:           null,
      headline,
      body:                null,
      permalink_url:       null,
      date:                r.segments?.date ?? '',
      impressions:         toInt(r.metrics?.impressions),
      clicks:              toInt(r.metrics?.clicks),
      spend:               microsToReal(r.metrics?.costMicros),
      reach:               0,
      frequency:           null,
      video_3s_views:      null,
      video_thruplay_views: null,
    }
  })

  // ── Palavras-chave ────────────────────────────────────────────────────────────
  const keywords: MappedKeywordDay[] = keywordRows
    .filter(r => r.adGroupCriterion?.keyword?.text)
    .map(r => ({
      client_slug:   clientSlug,
      platform:      'google',
      campaign_id:   r.campaign?.id ?? '',
      campaign_name: r.campaign?.name ?? '',
      ad_group_id:   r.adGroup?.id ?? '',
      ad_group_name: r.adGroup?.name ?? '',
      keyword_id:    r.adGroupCriterion?.criterionId ?? '',
      keyword_text:  r.adGroupCriterion?.keyword?.text ?? '',
      match_type:    r.adGroupCriterion?.keyword?.matchType ?? '',
      status:        r.adGroupCriterion?.status ?? '',
      date:          r.segments?.date ?? '',
      impressions:   toInt(r.metrics?.impressions),
      clicks:        toInt(r.metrics?.clicks),
      spend:         microsToReal(r.metrics?.costMicros),
      conversions:   parseFloat(r.metrics?.conversions ?? '0'),
    }))

  // ── Termos de pesquisa ────────────────────────────────────────────────────────
  const searchTerms: MappedSearchTermDay[] = searchTermRows
    .filter(r => r.searchTermView?.searchTerm)
    .map(r => ({
      client_slug:   clientSlug,
      platform:      'google',
      campaign_id:   r.campaign?.id ?? '',
      campaign_name: r.campaign?.name ?? '',
      ad_group_id:   r.adGroup?.id ?? '',
      ad_group_name: r.adGroup?.name ?? '',
      keyword_id:    r.adGroupCriterion?.criterionId ?? '',
      keyword_text:  r.adGroupCriterion?.keyword?.text ?? '',
      search_term:   r.searchTermView?.searchTerm ?? '',
      match_type:    r.adGroupCriterion?.keyword?.matchType ?? '',
      date:          r.segments?.date ?? '',
      impressions:   toInt(r.metrics?.impressions),
      clicks:        toInt(r.metrics?.clicks),
      spend:         microsToReal(r.metrics?.costMicros),
      conversions:   parseFloat(r.metrics?.conversions ?? '0'),
    }))

  return { campaigns, adSets, ads, keywords, searchTerms }
}
