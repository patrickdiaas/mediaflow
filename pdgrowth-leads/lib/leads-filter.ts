// Filtro centralizado de "lead válido de campanha".
// Lead só conta se vier de tráfego pago (utm_medium em whitelist) e não for
// notificação do RD Station CRM (Negociação criada/atualizada — são updates
// no funil, não conversões novas).

export const VALID_UTM_MEDIUMS = [
  "cpc",
  "paid",
  "paid_social",
  "social",
  "display",
] as const;

// Padrões de conversion_event que são eventos do CRM e NÃO conversões reais.
// Avaliar como ILIKE (case-insensitive) no Postgres.
export const CRM_EVENT_ILIKE_PATTERNS = [
  "%RD Station CRM%",
];

// Aplica os dois filtros (utm_medium + conversion_event) num query builder
// do Supabase. Devolve o mesmo builder pra encadear.
export function filterCampaignLeads(q: any): any {
  let next = q.in("utm_medium", [...VALID_UTM_MEDIUMS]);
  for (const pat of CRM_EVENT_ILIKE_PATTERNS) {
    next = next.not("conversion_event", "ilike", pat);
  }
  return next;
}

// Versão pós-fetch (para casos em que precisamos filtrar arrays já carregados).
export function isCampaignLead(lead: {
  utm_medium?: string | null;
  conversion_event?: string | null;
}): boolean {
  const med = lead.utm_medium?.toLowerCase() ?? null;
  if (!med || !(VALID_UTM_MEDIUMS as readonly string[]).includes(med)) return false;
  const ev = lead.conversion_event ?? "";
  for (const pat of CRM_EVENT_ILIKE_PATTERNS) {
    const needle = pat.replace(/%/g, "").toLowerCase();
    if (needle && ev.toLowerCase().includes(needle)) return false;
  }
  return true;
}
