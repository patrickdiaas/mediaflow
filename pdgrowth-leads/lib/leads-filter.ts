// Filtro centralizado de "lead válido de campanha".
// Um lead conta como campanha se:
//   a) utm_medium estiver na whitelist (cpc/paid/paid_social/social/display), OU
//   b) conversion_event estiver em `mappedEvents` (LPs mapeadas em event_to_campaign).
// Em qualquer caso, excluímos eventos de CRM (Negociação criada/atualizada no RD).

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

// Aplica o filtro no query builder do Supabase.
// `mappedEvents`: lista de conversion_event que devem ser considerados campanha
// mesmo sem utm_medium pago. Quando vazia, só usa o filtro de utm_medium.
export function filterCampaignLeads(q: any, mappedEvents: string[] = []): any {
  let next: any;
  if (mappedEvents.length === 0) {
    next = q.in("utm_medium", [...VALID_UTM_MEDIUMS]);
  } else {
    // OR: utm_medium ∈ whitelist OU conversion_event ∈ mappedEvents.
    // PostgREST .or() exige formato 'col.op.value' separado por vírgula.
    // Valores com vírgula ou parêntese precisam ser quotados; sanitizamos.
    const utmList = VALID_UTM_MEDIUMS.join(",");
    const evList = mappedEvents
      .filter(e => e && typeof e === "string")
      .map(e => `"${e.replace(/"/g, "")}"`)
      .join(",");
    next = q.or(`utm_medium.in.(${utmList}),conversion_event.in.(${evList})`);
  }
  for (const pat of CRM_EVENT_ILIKE_PATTERNS) {
    next = next.not("conversion_event", "ilike", pat);
  }
  return next;
}

// Versão pós-fetch (para casos em que precisamos filtrar arrays já carregados).
export function isCampaignLead(
  lead: { utm_medium?: string | null; conversion_event?: string | null },
  mappedEvents: Set<string> = new Set(),
): boolean {
  const ev = lead.conversion_event ?? "";
  // Exclusão de CRM
  for (const pat of CRM_EVENT_ILIKE_PATTERNS) {
    const needle = pat.replace(/%/g, "").toLowerCase();
    if (needle && ev.toLowerCase().includes(needle)) return false;
  }
  const med = lead.utm_medium?.toLowerCase() ?? null;
  if (med && (VALID_UTM_MEDIUMS as readonly string[]).includes(med)) return true;
  if (ev && mappedEvents.has(ev)) return true;
  return false;
}
