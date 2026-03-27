// ─── Clients ──────────────────────────────────────────────────────────────────
export interface Client {
  id: string;
  slug: string;
  name: string;
  meta_ad_account_id: string | null;
  google_ads_customer_id: string | null;
  active: boolean;
  created_at: string;
}

// ─── Sales ────────────────────────────────────────────────────────────────────
export type Gateway = "dmguru" | "hotmart" | "eduzz";
export type SaleStatus = "approved" | "refunded" | "chargeback" | "pending" | "cancelled";
export type SaleType = "main" | "order_bump" | "upsell";
export type Platform = "meta" | "google";
export type CreativeType = "image" | "video" | "carousel" | "collection";

export interface Sale {
  id: string;
  client_slug: string;
  gateway: Gateway;
  gateway_order_id: string;
  status: SaleStatus;
  product_id: string | null;
  product_name: string | null;
  plan_name: string | null;
  amount: number;
  currency: string;
  payment_method: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  sale_type: SaleType;
  approved_at: string | null;
  created_at: string;
}

// ─── Ad Data ──────────────────────────────────────────────────────────────────
export interface AdCampaign {
  id: string;
  client_slug: string;
  platform: Platform;
  campaign_id: string;
  campaign_name: string;
  status: string | null;
  objective: string | null;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
}

export interface AdSet {
  id: string;
  client_slug: string;
  platform: Platform;
  campaign_id: string;
  campaign_name: string | null;
  ad_set_id: string;
  ad_set_name: string;
  status: string | null;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
}

export interface AdCreative {
  id: string;
  client_slug: string;
  platform: Platform;
  campaign_id: string | null;
  campaign_name: string | null;
  ad_set_id: string | null;
  ad_set_name: string | null;
  ad_id: string;
  ad_name: string;
  status: string | null;
  creative_type: CreativeType | null;
  thumbnail_url: string | null;
  video_url: string | null;
  permalink_url: string | null;   // link direto para o anúncio no Meta/Google
  headline: string | null;
  body: string | null;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  frequency: number | null;           // impressions / reach — fadiga do criativo
  video_3s_rate: number | null;       // hook rate: % que assistiu 3s (vídeo)
  video_thruplay_rate: number | null; // hold rate: % que assistiu até o fim (vídeo)
}

// ─── Aggregated / Computed ───────────────────────────────────────────────────
export interface KPIData {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  color?: "accent" | "blue" | "gold" | "red" | "purple";
  icon?: string;
}

export interface FunnelStep {
  label: string;
  value: number;
  rate?: number;
  sublabel?: string;
}

export interface TrendPoint {
  date: string;
  revenue: number;
  spend: number;
  sales: number;
  roas: number;
}

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export interface HorizontalBarItem {
  label: string;
  value: number;
  rate: number;   // conversion rate %
  color?: string;
}

export interface OverviewSummary {
  revenue: number;
  spend: number;
  roas: number;
  profit: number;
  roi: number;
  sales: number;
  cpa: number;
  avg_ticket: number;
  refunds: number;
  conv_rate: number;
}

export interface CampaignRow {
  campaign_id: string;
  campaign_name: string;
  platform: Platform;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  revenue: number;
  sales: number;
  roas: number;
  cpa: number;
}

export interface AdSetRow {
  ad_set_id: string;
  ad_set_name: string;
  campaign_name: string;
  platform: Platform;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  revenue: number;
  sales: number;
  roas: number;
  cpa: number;
}

export interface CreativeRow {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  platform: Platform;
  creative_type: CreativeType | null;
  thumbnail_url: string | null;
  video_url: string | null;
  permalink_url: string | null;
  headline: string | null;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  revenue: number;
  sales: number;
  roas: number;
  cpa: number;
  cpm: number;
  conv_rate: number;
  frequency: number | null;
  video_3s_rate: number | null;
  video_thruplay_rate: number | null;
}

export interface ProductRow {
  product_id: string;
  product_name: string;
  gateway: Gateway;
  sales: number;
  revenue: number;
  refunds: number;
  refund_rate: number;
  avg_ticket: number;
  is_order_bump: boolean;
}

export interface SaleRow {
  id: string;
  created_at: string;
  gateway: Gateway;
  sale_type: SaleType;
  amount: number;
  status: SaleStatus;
  product_name: string | null;
  utm_medium: string | null;    // nome da campanha
  utm_campaign: string | null;  // conjunto de anúncios
  utm_content: string | null;   // nome do criativo
  utm_source: string | null;    // posicionamento (Instagram_Feed, etc.)
  utm_term: string | null;      // ID do anúncio
  payment_method: string | null;
}

export interface DashboardFilters {
  client: string;
  platform: Platform | "all";
  period: string;
  campaign: string;
}
