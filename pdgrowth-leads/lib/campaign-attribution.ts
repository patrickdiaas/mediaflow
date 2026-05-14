// Lógica centralizada de atribuir um lead à campanha correta.
// Ordem de prioridade:
//   1. Match exato: lead.utm_campaign === ad_campaign.campaign_name
//   2. Match por campaign_id numérico (Google às vezes manda só o ID)
//   3. Alias cadastrado em campaign_aliases (resolve UTMs antigas/erradas)
//   4. Fuzzy match (split por -, _, etc — palavras significativas em comum)
//   5. Event mapping (lead sem utm_campaign mas com conversion_event mapeado)
//   6. Sem match → vai pra lista de "leads sem campanha atribuída"

export interface CampaignLite {
  campaign_id?: string;
  campaign_name: string;
  campaign_ids?: Set<string>;
}

export interface CampaignAlias {
  alias_utm_campaign: string;
  target_campaign_name: string;
}

export interface EventToCampaign {
  conversion_event: string;
  target_campaign_name: string;
}

export type AttributionMethod = "exact" | "id" | "alias" | "fuzzy" | "event" | "unmatched";

export interface AttributionResult {
  campaign_name: string | null; // null = unmatched
  method: AttributionMethod;
  matched_alias?: string;
  matched_event?: string;
}

function extractWords(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(w => w.length > 1);
}

function fuzzyMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const al = a.toLowerCase(), bl = b.toLowerCase();
  if (al.includes(bl) || bl.includes(al)) return true;
  const aWords = extractWords(a), bWords = extractWords(b);
  if (aWords.length === 0 || bWords.length === 0) return false;
  const [smaller, larger] = aWords.length <= bWords.length ? [aWords, bWords] : [bWords, aWords];
  return smaller.length >= 1 && smaller.every(w => larger.includes(w));
}

// Constrói índices reutilizáveis a partir das campanhas, aliases e mapas de evento.
export function buildAttributionIndex(
  campaigns: CampaignLite[],
  aliases: CampaignAlias[],
  eventMaps: EventToCampaign[] = [],
) {
  const namesSet = new Set<string>();
  const idToName = new Map<string, string>();
  for (const c of campaigns) {
    namesSet.add(c.campaign_name);
    if (c.campaign_id) idToName.set(c.campaign_id, c.campaign_name);
    if (c.campaign_ids) for (const id of Array.from(c.campaign_ids)) idToName.set(id, c.campaign_name);
  }
  const aliasMap = new Map<string, string>();
  for (const a of aliases) aliasMap.set(a.alias_utm_campaign, a.target_campaign_name);
  const eventMap = new Map<string, string>();
  for (const e of eventMaps) eventMap.set(e.conversion_event, e.target_campaign_name);
  const namesList = Array.from(namesSet);
  return { namesSet, idToName, aliasMap, eventMap, namesList };
}

export type AttributionIndex = ReturnType<typeof buildAttributionIndex>;

export function attributeLead(
  utmCampaign: string | null | undefined,
  index: AttributionIndex,
  conversionEvent?: string | null,
): AttributionResult {
  if (utmCampaign) {
    // 1. Exato
    if (index.namesSet.has(utmCampaign)) return { campaign_name: utmCampaign, method: "exact" };
    // 2. Por campaign_id
    const byId = index.idToName.get(utmCampaign);
    if (byId) return { campaign_name: byId, method: "id" };
    // 3. Alias cadastrado
    const aliased = index.aliasMap.get(utmCampaign);
    if (aliased && index.namesSet.has(aliased)) {
      return { campaign_name: aliased, method: "alias", matched_alias: utmCampaign };
    }
    // 4. Fuzzy
    const fuzzy = index.namesList.find(n => fuzzyMatch(n, utmCampaign));
    if (fuzzy) return { campaign_name: fuzzy, method: "fuzzy" };
  }
  // 5. Event mapping (lead sem utm_campaign válido, mas conversion_event mapeado)
  if (conversionEvent) {
    const byEvent = index.eventMap.get(conversionEvent);
    if (byEvent && index.namesSet.has(byEvent)) {
      return { campaign_name: byEvent, method: "event", matched_event: conversionEvent };
    }
  }
  return { campaign_name: null, method: "unmatched" };
}

// Helper para buscar aliases (usar com qualquer cliente Supabase).
export async function fetchAliases(supabase: any, clientSlug: string): Promise<CampaignAlias[]> {
  if (!clientSlug || clientSlug === "all") {
    const { data } = await supabase.from("campaign_aliases").select("alias_utm_campaign, target_campaign_name");
    return (data ?? []) as CampaignAlias[];
  }
  const { data } = await supabase
    .from("campaign_aliases")
    .select("alias_utm_campaign, target_campaign_name")
    .eq("client_slug", clientSlug);
  return (data ?? []) as CampaignAlias[];
}

// Helper para buscar mapas conversion_event → campanha.
export async function fetchEventMaps(supabase: any, clientSlug: string): Promise<EventToCampaign[]> {
  if (!clientSlug || clientSlug === "all") {
    const { data } = await supabase.from("event_to_campaign").select("conversion_event, target_campaign_name");
    return (data ?? []) as EventToCampaign[];
  }
  const { data } = await supabase
    .from("event_to_campaign")
    .select("conversion_event, target_campaign_name")
    .eq("client_slug", clientSlug);
  return (data ?? []) as EventToCampaign[];
}
