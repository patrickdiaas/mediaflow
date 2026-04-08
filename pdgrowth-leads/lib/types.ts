// ─── Clients ──────────────────────────────────────────────────────────────────
export interface Client {
  id: string;
  slug: string;
  name: string;
  display_name: string | null;
  meta_ad_account_id: string | null;
  google_ads_customer_id: string | null;
  google_ads_manager_id: string | null;
  rdstation_slug: string | null;
  active: boolean;
  created_at: string;
}

// ─── Leads ────────────────────────────────────────────────────────────────────
export type LeadSource = "rdstation" | "meta_leadform" | "manual";
export type Platform = "meta" | "google";
export type CreativeType = "image" | "video" | "carousel" | "collection";

export interface Lead {
  id: string;
  client_slug: string;
  source: LeadSource;
  lead_email: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  lead_company: string | null;
  conversion_event: string | null;
  landing_page: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  converted_at: string | null;
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
  landing_page_views: number;
  lead_form_submissions: number;
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
  permalink_url: string | null;
  headline: string | null;
  body: string | null;
  placement: string | null;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  frequency: number | null;
  video_3s_rate: number | null;
  video_thruplay_rate: number | null;
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
  leads: number;
  spend: number;
  cpl: number;
}

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export interface HorizontalBarItem {
  label: string;
  value: number;
  rate: number;
  color?: string;
}

export interface RegionRow {
  region: string;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
}

export interface CampaignRow {
  campaign_id: string;
  campaign_name: string;
  platform: Platform;
  status: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  leads: number;
  cpl: number;
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
  leads: number;
  cpl: number;
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
  placement: string | null;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  leads: number;
  cpl: number;
  cpm: number;
  frequency: number | null;
  video_3s_rate: number | null;
  video_thruplay_rate: number | null;
}

export interface LeadRow {
  id: string;
  converted_at: string;
  source: LeadSource;
  lead_name: string | null;
  lead_email: string | null;
  conversion_event: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_source: string | null;
  utm_term: string | null;
}

export interface DashboardFilters {
  client: string;
  platform: Platform | "all";
  period: string;
  campaign: string;
}

export interface KeywordRow {
  keyword_id: string;
  keyword_text: string;
  match_type: string;
  campaign_name: string;
  ad_group_name: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  conversions: number;
  cpc: number;
}

export interface SearchTermRow {
  search_term: string;
  keyword_text: string;
  campaign_name: string;
  ad_group_name: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  conversions: number;
}
