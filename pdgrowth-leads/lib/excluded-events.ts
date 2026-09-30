// conversion_events que devem ser excluídos por completo dos KPIs de leads/CPL
// (não "separados" como campaign_budget_groups — excluídos de vez). Uso real:
// campanhas de Lead Ads de terceiros (outra agência) que passam no filtro de
// "lead pago" (utm_medium=cpc) mas não são mídia do PD Growth.

export interface ExcludedConversionEvent {
  conversion_event: string;
  reason: string | null;
}

export async function fetchExcludedEvents(supabase: any): Promise<ExcludedConversionEvent[]> {
  const { data } = await supabase.from("excluded_conversion_events").select("conversion_event, reason");
  return (data ?? []) as ExcludedConversionEvent[];
}
