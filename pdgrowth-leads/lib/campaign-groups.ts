// Campanhas com verba PRÓPRIA, separada do orçamento regular do cliente
// (ex: "Keep It Real" em MedSystems/Negócios e Redes). O gasto dessas
// campanhas não deve entrar no investimento total (KPIs, pacing) — é
// reportado à parte, agrupado por group_name.

export interface CampaignBudgetGroup {
  campaign_name: string;
  group_name: string;
}

export async function fetchCampaignGroups(supabase: any, clientSlug: string): Promise<CampaignBudgetGroup[]> {
  const q = supabase.from("campaign_budget_groups").select("campaign_name, group_name");
  const { data } = await (clientSlug && clientSlug !== "all" ? q.eq("client_slug", clientSlug) : q);
  return (data ?? []) as CampaignBudgetGroup[];
}

// Separa uma lista de linhas de ad_campaigns (ou já agregadas por campanha)
// entre "regular" (conta no investimento total) e "grouped" (verba separada,
// indexado por group_name).
export function splitByBudgetGroup<T extends { campaign_name: string }>(
  rows: T[],
  groups: CampaignBudgetGroup[],
): { regular: T[]; grouped: Map<string, T[]> } {
  const groupNameByCampaign = new Map(groups.map(g => [g.campaign_name, g.group_name]));
  const regular: T[] = [];
  const grouped = new Map<string, T[]>();
  for (const r of rows) {
    const g = groupNameByCampaign.get(r.campaign_name);
    if (g) {
      const list = grouped.get(g) ?? [];
      list.push(r);
      grouped.set(g, list);
    } else {
      regular.push(r);
    }
  }
  return { regular, grouped };
}
