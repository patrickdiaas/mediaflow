export type StepType = "sales" | "bump" | "upsell" | "downsell" | "thanks" | "custom";
export type VariantStatus = "active" | "paused";
export type FunnelStatus = "active" | "paused" | "archived";

export interface Account {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Client {
  id: string;
  account_id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Funnel {
  id: string;
  account_id: string;
  client_id: string;
  name: string;
  slug: string;
  status: FunnelStatus;
  notes: string | null;
  created_at: string;
}

export interface FunnelStep {
  id: string;
  funnel_id: string;
  ordem: number;
  type: StepType;
  name: string;
  created_at: string;
}

export interface FunnelVariant {
  id: string;
  step_id: string;
  name: string;
  destination_url: string;
  weight: number;
  status: VariantStatus;
  created_at: string;
}

export interface VariantMetrics {
  variant_id: string;
  step_id: string;
  funnel_id: string;
  variant_name: string;
  step_name: string;
  step_type: StepType;
  visitors: number;
  sales: number;
  revenue: number;
  cvr_pct: number;
}
