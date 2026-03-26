import type {
  Client, KPIData, FunnelStep, TrendPoint,
  CampaignRow, AdSetRow, CreativeRow, ProductRow, SaleRow,
  DonutSlice, HorizontalBarItem, OverviewSummary,
} from "./types";

// ─── Clients ──────────────────────────────────────────────────────────────────
export const mockClients: Client[] = [
  {
    id: "1",
    slug: "amplainstituto",
    name: "Ampla Instituto",
    meta_ad_account_id: null,
    google_ads_customer_id: null,
    active: true,
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "2",
    slug: "bixarica",
    name: "Bixa Rica",
    meta_ad_account_id: null,
    google_ads_customer_id: null,
    active: true,
    created_at: "2024-01-01T00:00:00Z",
  },
];

// ─── Overview summary ─────────────────────────────────────────────────────────
export const mockSummary: OverviewSummary = {
  revenue:    84_320,
  spend:      18_740,
  roas:       4.50,
  profit:     65_580,
  roi:        349.9,
  sales:      312,
  cpa:        60.06,
  avg_ticket: 270.28,
  refunds:    2_840,
  conv_rate:  1.68,
};

// ─── KPIs ─────────────────────────────────────────────────────────────────────
export const mockKPIs: KPIData[] = [
  { label: "Faturamento",      value: "R$ 84.320",  trend: +12.4, color: "accent" },
  { label: "Gastos Anúncios",  value: "R$ 18.740",  trend: +8.2,  color: "blue"   },
  { label: "ROAS",             value: "4,50×",      trend: +3.8,  color: "purple" },
  { label: "Lucro",            value: "R$ 65.580",  trend: +14.1, color: "accent" },
  { label: "ROI",              value: "349,9%",     trend: +5.2,  color: "purple" },
  { label: "Vendas",           value: "312",        trend: +18.6, color: "accent" },
  { label: "CPA",              value: "R$ 60,06",  trend: -9.4,  color: "gold"   },
  { label: "Ticket Médio",     value: "R$ 270,28", trend: -2.1,  color: "gold"   },
  { label: "Reembolsos",       value: "R$ 2.840",  trend: -1.2,  color: "red"    },
  { label: "Taxa Conversão",   value: "1,68%",     trend: +0.3,  color: "blue"   },
];

// ─── Funnel perpétuo ─────────────────────────────────────────────────────────
export const mockFunnel: FunnelStep[] = [
  { label: "Impressões",  value: 1_240_000, sublabel: "CPM R$ 15,11" },
  { label: "Cliques",     value: 24_800,    rate: 2.0,  sublabel: "CTR 2,0%" },
  { label: "Visitas",     value: 18_600,    rate: 75.0, sublabel: "75% dos cliques" },
  { label: "Checkout",    value: 1_860,     rate: 10.0, sublabel: "10% das visitas" },
  { label: "Vendas",      value: 312,       rate: 16.8, sublabel: "Conv. 16,8%" },
];

// ─── Donut — Pagamentos ───────────────────────────────────────────────────────
export const mockPaymentDonut: DonutSlice[] = [
  { label: "Cartão",  value: 156, color: "#3B82C4" },
  { label: "PIX",     value: 118, color: "#CAFF04" },
  { label: "Boleto",  value: 38,  color: "#FF6B35" },
];

// ─── Donut — Produtos ─────────────────────────────────────────────────────────
export const mockProductDonut: DonutSlice[] = [
  { label: "Produto A — Anual",    value: 148, color: "#CAFF04" },
  { label: "Produto A — Mensal",   value: 94,  color: "#2D9B6A" },
  { label: "Produto B — Único",    value: 43,  color: "#3B82C4" },
  { label: "Produto B — Parcelas", value: 27,  color: "#FF6B35" },
];

// ─── UTM Sources ──────────────────────────────────────────────────────────────
export const mockUTMSources: HorizontalBarItem[] = [
  { label: "paid_metaads",      value: 162, rate: 12.9, color: "#3B82C4" },
  { label: "organic_api",       value: 48,  rate: 10.8, color: "#2D9B6A" },
  { label: "organic_instagram", value: 32,  rate: 7.6,  color: "#2D9B6A" },
  { label: "paid_google",       value: 41,  rate: 14.2, color: "#FF6B35" },
  { label: "organic_direct",    value: 18,  rate: 9.1,  color: "#6A6A7A" },
  { label: "Desconhecido",      value: 11,  rate: 5.3,  color: "#3A3A48" },
];

// ─── Trend ────────────────────────────────────────────────────────────────────
export const mockTrend: TrendPoint[] = [
  { date: "01/03", revenue: 2_400, spend: 580, sales: 9,  roas: 4.14 },
  { date: "02/03", revenue: 3_100, spend: 640, sales: 11, roas: 4.84 },
  { date: "03/03", revenue: 2_800, spend: 590, sales: 10, roas: 4.75 },
  { date: "04/03", revenue: 3_900, spend: 820, sales: 14, roas: 4.76 },
  { date: "05/03", revenue: 4_200, spend: 910, sales: 16, roas: 4.62 },
  { date: "06/03", revenue: 3_600, spend: 750, sales: 13, roas: 4.80 },
  { date: "07/03", revenue: 2_100, spend: 480, sales: 8,  roas: 4.38 },
  { date: "08/03", revenue: 2_700, spend: 560, sales: 10, roas: 4.82 },
  { date: "09/03", revenue: 3_300, spend: 700, sales: 12, roas: 4.71 },
  { date: "10/03", revenue: 4_800, spend: 980, sales: 17, roas: 4.90 },
  { date: "11/03", revenue: 5_200, spend: 1_050, sales: 19, roas: 4.95 },
  { date: "12/03", revenue: 4_600, spend: 930,   sales: 17, roas: 4.95 },
  { date: "13/03", revenue: 3_800, spend: 800,   sales: 14, roas: 4.75 },
  { date: "14/03", revenue: 2_900, spend: 620,   sales: 10, roas: 4.68 },
  { date: "15/03", revenue: 3_400, spend: 710,   sales: 13, roas: 4.79 },
];

// ─── Campaigns ────────────────────────────────────────────────────────────────
export const mockCampaigns: CampaignRow[] = [
  {
    campaign_id: "c1", campaign_name: "Vendas | Produto A | Conversão", platform: "meta",
    impressions: 480_000, clicks: 9_600, ctr: 2.0, spend: 6_800,
    revenue: 32_400, sales: 120, roas: 4.76, cpa: 56.67,
  },
  {
    campaign_id: "c2", campaign_name: "Vendas | Produto B | Conversão", platform: "meta",
    impressions: 320_000, clicks: 6_400, ctr: 2.0, spend: 5_200,
    revenue: 24_800, sales: 92, roas: 4.77, cpa: 56.52,
  },
  {
    campaign_id: "c3", campaign_name: "Sales | Product A | Max Conv", platform: "google",
    impressions: 280_000, clicks: 5_600, ctr: 2.0, spend: 4_100,
    revenue: 18_200, sales: 67, roas: 4.44, cpa: 61.19,
  },
  {
    campaign_id: "c4", campaign_name: "Remarketing | Carrinho | Meta", platform: "meta",
    impressions: 160_000, clicks: 3_200, ctr: 2.0, spend: 2_640,
    revenue: 9_120, sales: 33, roas: 3.45, cpa: 80.0,
  },
];

// ─── Ad Sets ──────────────────────────────────────────────────────────────────
export const mockAdSets: AdSetRow[] = [
  {
    ad_set_id: "as1", ad_set_name: "Interesse | 25-44 | Mulheres", campaign_name: "Vendas | Produto A | Conversão", platform: "meta",
    impressions: 240_000, clicks: 4_800, ctr: 2.0, spend: 3_400,
    revenue: 16_200, sales: 60, roas: 4.76, cpa: 56.67,
  },
  {
    ad_set_id: "as2", ad_set_name: "Lookalike 1% | Compradores", campaign_name: "Vendas | Produto A | Conversão", platform: "meta",
    impressions: 240_000, clicks: 4_800, ctr: 2.0, spend: 3_400,
    revenue: 16_200, sales: 60, roas: 4.76, cpa: 56.67,
  },
  {
    ad_set_id: "as3", ad_set_name: "Remarketing | Visitantes 30d", campaign_name: "Remarketing | Carrinho | Meta", platform: "meta",
    impressions: 160_000, clicks: 3_200, ctr: 2.0, spend: 2_640,
    revenue: 9_120, sales: 33, roas: 3.45, cpa: 80.0,
  },
  {
    ad_set_id: "as4", ad_set_name: "Keywords | Produto A Comprar", campaign_name: "Sales | Product A | Max Conv", platform: "google",
    impressions: 140_000, clicks: 2_800, ctr: 2.0, spend: 2_050,
    revenue: 9_100, sales: 33, roas: 4.44, cpa: 62.12,
  },
  {
    ad_set_id: "as5", ad_set_name: "Keywords | Brand", campaign_name: "Sales | Product A | Max Conv", platform: "google",
    impressions: 140_000, clicks: 2_800, ctr: 2.0, spend: 2_050,
    revenue: 9_100, sales: 34, roas: 4.44, cpa: 60.29,
  },
];

// ─── Creatives ────────────────────────────────────────────────────────────────
export const mockCreatives: CreativeRow[] = [
  {
    ad_id: "ad1", ad_name: "VSL Principal 60s | v1", campaign_name: "Vendas | Produto A | Conversão", platform: "meta",
    creative_type: "video",
    thumbnail_url: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80",
    video_url: null,
    impressions: 180_000, clicks: 4_320, ctr: 2.4, spend: 3_200,
    revenue: 16_800, sales: 62, roas: 5.25, cpa: 51.61,
  },
  {
    ad_id: "ad2", ad_name: "Carrossel Benefícios | v2", campaign_name: "Vendas | Produto A | Conversão", platform: "meta",
    creative_type: "carousel",
    thumbnail_url: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&q=80",
    video_url: null,
    impressions: 160_000, clicks: 3_040, ctr: 1.9, spend: 2_800,
    revenue: 12_400, sales: 46, roas: 4.43, cpa: 60.87,
  },
  {
    ad_id: "ad3", ad_name: "Imagem Estática | Depoimento 1", campaign_name: "Vendas | Produto B | Conversão", platform: "meta",
    creative_type: "image",
    thumbnail_url: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&q=80",
    video_url: null,
    impressions: 140_000, clicks: 2_380, ctr: 1.7, spend: 2_100,
    revenue: 8_400, sales: 31, roas: 4.0, cpa: 67.74,
  },
  {
    ad_id: "ad4", ad_name: "VSL Curta 15s | Retargeting", campaign_name: "Remarketing | Carrinho | Meta", platform: "meta",
    creative_type: "video",
    thumbnail_url: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=400&q=80",
    video_url: null,
    impressions: 80_000, clicks: 2_000, ctr: 2.5, spend: 1_640,
    revenue: 6_480, sales: 24, roas: 3.95, cpa: 68.33,
  },
  {
    ad_id: "ad5", ad_name: "Imagem | Urgência Oferta", campaign_name: "Vendas | Produto B | Conversão", platform: "meta",
    creative_type: "image",
    thumbnail_url: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&q=80",
    video_url: null,
    impressions: 120_000, clicks: 1_920, ctr: 1.6, spend: 1_840,
    revenue: 7_200, sales: 27, roas: 3.91, cpa: 68.15,
  },
  {
    ad_id: "ad6", ad_name: "Responsive Search | Comprar", campaign_name: "Sales | Product A | Max Conv", platform: "google",
    creative_type: "image",
    thumbnail_url: null,
    video_url: null,
    impressions: 140_000, clicks: 2_800, ctr: 2.0, spend: 2_050,
    revenue: 9_100, sales: 34, roas: 4.44, cpa: 60.29,
  },
];

// ─── Products ─────────────────────────────────────────────────────────────────
export const mockProducts: ProductRow[] = [
  { product_id: "p1", product_name: "Produto A — Plano Anual",    gateway: "dmguru",  sales: 148, revenue: 44_400, refunds: 5,  refund_rate: 3.38, avg_ticket: 300 },
  { product_id: "p2", product_name: "Produto A — Plano Mensal",   gateway: "hotmart", sales: 94,  revenue: 14_100, refunds: 4,  refund_rate: 4.26, avg_ticket: 150 },
  { product_id: "p3", product_name: "Produto B — Único",          gateway: "dmguru",  sales: 43,  revenue: 17_200, refunds: 3,  refund_rate: 6.98, avg_ticket: 400 },
  { product_id: "p4", product_name: "Produto B — Parcelado 12×",  gateway: "eduzz",   sales: 27,  revenue: 8_640,  refunds: 2,  refund_rate: 7.41, avg_ticket: 320 },
];

// ─── Sales Table ──────────────────────────────────────────────────────────────
// utm_medium   = nome da campanha na plataforma
// utm_campaign = conjunto de anúncios
// utm_content  = nome do criativo
// utm_source   = posicionamento (Instagram_Feed, Facebook_Feed…)
// utm_term     = ID do anúncio
export const mockSales: SaleRow[] = [
  { id: "s1",  created_at: "2024-03-15T14:22:00Z", gateway: "dmguru",  sale_type: "main",       amount: 300, status: "approved",
    utm_medium: "lt-ws-destrave-prosperidade-vendas", utm_campaign: "00-adv-aberto-regras",    utm_content: "ad08-video-criativo-06-lt-prosperidade", utm_source: "Instagram_Feed",    utm_term: "120241143883600607", payment_method: "credit_card" },
  { id: "s2",  created_at: "2024-03-15T14:22:00Z", gateway: "dmguru",  sale_type: "order_bump", amount:  47, status: "approved",
    utm_medium: "lt-ws-destrave-prosperidade-vendas", utm_campaign: "00-adv-aberto-regras",    utm_content: "ad08-video-criativo-06-lt-prosperidade", utm_source: "Instagram_Feed",    utm_term: "120241143883600607", payment_method: "credit_card" },
  { id: "s3",  created_at: "2024-03-15T13:45:00Z", gateway: "hotmart", sale_type: "main",       amount: 150, status: "approved",
    utm_medium: "lt-ws-destrave-prosperidade-vendas", utm_campaign: "00-adv-aberto-regras",    utm_content: "ad03-imagem-depoimento-01",              utm_source: "Facebook_Feed",     utm_term: "120241143883600608", payment_method: "pix" },
  { id: "s4",  created_at: "2024-03-15T12:10:00Z", gateway: "dmguru",  sale_type: "main",       amount: 400, status: "approved",
    utm_medium: "lt-ws-destrave-prosperidade-vendas", utm_campaign: "01-ret-visitantes-7d",    utm_content: "ad05-video-curto-15s-ret",               utm_source: "Instagram_Stories", utm_term: "120241143883600609", payment_method: "credit_card" },
  { id: "s5",  created_at: "2024-03-15T11:30:00Z", gateway: "dmguru",  sale_type: "upsell",     amount: 197, status: "approved",
    utm_medium: "lt-ws-destrave-prosperidade-vendas", utm_campaign: "01-ret-visitantes-7d",    utm_content: "ad05-video-curto-15s-ret",               utm_source: "Instagram_Stories", utm_term: "120241143883600609", payment_method: "credit_card" },
  { id: "s6",  created_at: "2024-03-15T11:30:00Z", gateway: "dmguru",  sale_type: "main",       amount: 300, status: "refunded",
    utm_medium: "lt-ws-destrave-prosperidade-vendas", utm_campaign: "00-adv-aberto-regras",    utm_content: "ad08-video-criativo-06-lt-prosperidade", utm_source: "Facebook_Feed",     utm_term: "120241143883600607", payment_method: "credit_card" },
  { id: "s7",  created_at: "2024-03-15T10:55:00Z", gateway: "dmguru",  sale_type: "main",       amount: 320, status: "approved",
    utm_medium: "vendas-produto-b-perpétuo",          utm_campaign: "02-adv-interesse-amplo",  utm_content: "ad11-carrossel-beneficios-02",           utm_source: "Facebook_Feed",     utm_term: "120241143883600610", payment_method: "credit_card" },
  { id: "s8",  created_at: "2024-03-14T18:40:00Z", gateway: "dmguru",  sale_type: "main",       amount: 300, status: "approved",
    utm_medium: "lt-ws-destrave-prosperidade-vendas", utm_campaign: "00-adv-aberto-regras",    utm_content: "ad08-video-criativo-06-lt-prosperidade", utm_source: "Instagram_Feed",    utm_term: "120241143883600607", payment_method: "pix" },
  { id: "s9",  created_at: "2024-03-14T18:40:00Z", gateway: "dmguru",  sale_type: "order_bump", amount:  47, status: "approved",
    utm_medium: "lt-ws-destrave-prosperidade-vendas", utm_campaign: "00-adv-aberto-regras",    utm_content: "ad08-video-criativo-06-lt-prosperidade", utm_source: "Instagram_Feed",    utm_term: "120241143883600607", payment_method: "pix" },
  { id: "s10", created_at: "2024-03-14T17:15:00Z", gateway: "hotmart", sale_type: "main",       amount: 150, status: "approved",
    utm_medium: "lt-ws-destrave-prosperidade-vendas", utm_campaign: "01-ret-visitantes-7d",    utm_content: "ad05-video-curto-15s-ret",               utm_source: "Facebook_Stories",  utm_term: "120241143883600609", payment_method: "credit_card" },
  { id: "s11", created_at: "2024-03-14T16:00:00Z", gateway: "dmguru",  sale_type: "main",       amount: 400, status: "chargeback",
    utm_medium: "vendas-produto-b-perpétuo",          utm_campaign: "02-adv-interesse-amplo",  utm_content: "ad11-carrossel-beneficios-02",           utm_source: "Facebook_Feed",     utm_term: "120241143883600610", payment_method: "credit_card" },
  { id: "s12", created_at: "2024-03-14T14:30:00Z", gateway: "dmguru",  sale_type: "main",       amount: 300, status: "approved",
    utm_medium: "lt-ws-destrave-prosperidade-vendas", utm_campaign: "00-adv-aberto-regras",    utm_content: "ad03-imagem-depoimento-01",              utm_source: "Instagram_Feed",    utm_term: "120241143883600608", payment_method: "boleto" },
  { id: "s13", created_at: "2024-03-14T13:00:00Z", gateway: "dmguru",  sale_type: "main",       amount: 320, status: "approved",
    utm_medium: "vendas-produto-b-perpétuo",          utm_campaign: "02-adv-interesse-amplo",  utm_content: "ad11-carrossel-beneficios-02",           utm_source: "Instagram_Feed",    utm_term: "120241143883600610", payment_method: "credit_card" },
];
