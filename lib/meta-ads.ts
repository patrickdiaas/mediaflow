const META_API_BASE = 'https://graph.facebook.com/v21.0'

interface MetaInsightsAction {
  action_type: string
  value: string
}

interface MetaInsightsRoas {
  action_type: string
  value: string
}

interface MetaInsightsData {
  spend: string
  impressions: string
  clicks: string
  ctr: string
  cpc: string
  actions?: MetaInsightsAction[]
  purchase_roas?: MetaInsightsRoas[]
}

interface MetaCampaignRaw {
  id: string
  name: string
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'DELETED'
  objective: string
  insights?: { data: MetaInsightsData[] }
}

interface MetaAdRaw {
  id: string
  name: string
  campaign_id: string
  campaign: { name: string }
  creative: { id: string; object_type?: string }
  insights?: { data: MetaInsightsData[] }
}

export interface MappedCampaign {
  external_id: string
  platform: 'meta'
  mode: 'lead-gen' | 'ecommerce'
  nome: string
  status: 'ativa' | 'pausada' | 'encerrada'
  investimento: number
  impressoes: number
  cliques: number
  ctr: number
  cpc: number
  leads: number
  cpl: number
  vendas: number
  roas: number
}

export interface MappedCreative {
  external_id: string
  platform: 'meta'
  mode: 'lead-gen' | 'ecommerce'
  nome: string
  tipo: 'imagem' | 'video' | 'carrossel'
  campaign_external_id: string
  campanha: string
  impressoes: number
  cliques: number
  ctr: number
  leads: number
  cpl: number
  gasto: number
}

function mapStatus(status: string): 'ativa' | 'pausada' | 'encerrada' {
  if (status === 'ACTIVE') return 'ativa'
  if (status === 'PAUSED') return 'pausada'
  return 'encerrada'
}

function inferMode(objective: string): 'lead-gen' | 'ecommerce' {
  return objective === 'LEAD_GENERATION' ? 'lead-gen' : 'ecommerce'
}

function getActionValue(actions: MetaInsightsAction[] | undefined, type: string): number {
  return parseFloat(actions?.find(a => a.action_type === type)?.value ?? '0')
}

function parseInsights(data: MetaInsightsData | undefined) {
  if (!data) {
    return { investimento: 0, impressoes: 0, cliques: 0, ctr: 0, cpc: 0, leads: 0, cpl: 0, vendas: 0, roas: 0 }
  }
  const investimento = parseFloat(data.spend ?? '0')
  const leads = Math.round(
    getActionValue(data.actions, 'lead') ||
    getActionValue(data.actions, 'onsite_conversion.lead_grouped')
  )
  const vendas = Math.round(
    getActionValue(data.actions, 'purchase') ||
    getActionValue(data.actions, 'omni_purchase')
  )
  const cpl = leads > 0 ? parseFloat((investimento / leads).toFixed(2)) : 0
  const roas = parseFloat(data.purchase_roas?.[0]?.value ?? '0')
  return {
    investimento,
    impressoes: parseInt(data.impressions ?? '0', 10),
    cliques: parseInt(data.clicks ?? '0', 10),
    ctr: parseFloat(data.ctr ?? '0'),
    cpc: parseFloat(data.cpc ?? '0'),
    leads,
    cpl,
    vendas,
    roas,
  }
}

function inferCreativeType(objectType?: string): 'imagem' | 'video' | 'carrossel' {
  if (!objectType) return 'imagem'
  const t = objectType.toUpperCase()
  if (t === 'VIDEO') return 'video'
  if (t === 'SHARE') return 'carrossel'
  return 'imagem'
}

async function metaFetch<T>(path: string, params: Record<string, string>, token: string): Promise<T> {
  const url = new URL(`${META_API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  url.searchParams.set('access_token', token)
  const res = await fetch(url.toString())
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Meta API error ${res.status}: ${JSON.stringify(err)}`)
  }
  return res.json() as Promise<T>
}

export async function fetchMetaCampaigns(
  accountId: string,
  accessToken: string,
  datePreset = 'last_30d'
): Promise<MappedCampaign[]> {
  const insightFields = 'spend,impressions,clicks,ctr,cpc,actions,purchase_roas'
  const { data } = await metaFetch<{ data: MetaCampaignRaw[] }>(
    `/${accountId}/campaigns`,
    {
      fields: `id,name,status,objective,insights.date_preset(${datePreset}){${insightFields}}`,
      limit: '200',
      effective_status: '["ACTIVE","PAUSED"]',
    },
    accessToken
  )
  return data.map((c): MappedCampaign => {
    const insights = parseInsights(c.insights?.data[0])
    return {
      external_id: c.id,
      platform: 'meta',
      mode: inferMode(c.objective),
      nome: c.name,
      status: mapStatus(c.status),
      ...insights,
    }
  })
}

export async function fetchMetaAds(
  accountId: string,
  accessToken: string,
  campaignModeMap: Map<string, 'lead-gen' | 'ecommerce'>,
  datePreset = 'last_30d'
): Promise<MappedCreative[]> {
  const insightFields = 'spend,impressions,clicks,ctr,cpc,actions,purchase_roas'
  const { data } = await metaFetch<{ data: MetaAdRaw[] }>(
    `/${accountId}/ads`,
    {
      fields: `id,name,campaign_id,campaign{name},creative{id,object_type},insights.date_preset(${datePreset}){${insightFields}}`,
      limit: '200',
      effective_status: '["ACTIVE","PAUSED"]',
    },
    accessToken
  )
  return data.map((ad): MappedCreative => {
    const insights = parseInsights(ad.insights?.data[0])
    const cpl = insights.leads > 0 ? parseFloat((insights.investimento / insights.leads).toFixed(2)) : 0
    return {
      external_id: ad.id,
      platform: 'meta',
      mode: campaignModeMap.get(ad.campaign_id) ?? 'lead-gen',
      nome: ad.name,
      tipo: inferCreativeType(ad.creative?.object_type),
      campaign_external_id: ad.campaign_id,
      campanha: ad.campaign?.name ?? '',
      impressoes: insights.impressoes,
      cliques: insights.cliques,
      ctr: insights.ctr,
      leads: insights.leads,
      cpl,
      gasto: insights.investimento,
    }
  })
}
