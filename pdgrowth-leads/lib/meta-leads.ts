// Meta Lead Ads (Instant Forms) — puxa leads via Graph API e mapeia pra tabela `leads`.
// Usado por clientes que capturam leads direto no Meta (sem RD Station no meio).
//
// Fluxo:
//   1. /{ad_account_id}/promote_pages → pages associadas à conta
//   2. /{page_id}?fields=access_token → Page Access Token (System User precisa ter permissão na page)
//   3. /{page_id}/leadgen_forms (com pageToken) → lista forms da page
//   4. /{form_id}/leads (com pageToken, filtrado por time_created > sinceUnix)
//   5. Mapeia field_data → colunas da tabela `leads`
//
// Permissão necessária: System User com acesso à Page com Lead Access (leads_retrieval).

const META_API_BASE = "https://graph.facebook.com/v21.0";

interface MetaPage<T> { data: T[]; paging?: { next?: string } }

interface MetaLeadForm {
  id: string;
  name: string;
  status?: string;
  page?: { id: string; name?: string };
}

interface MetaLeadFieldDatum {
  name: string;
  values: string[];
}

export interface MetaLead {
  id: string;
  created_time: string;
  field_data: MetaLeadFieldDatum[];
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  form_id?: string;
  platform?: string;
}

export interface MappedLead {
  client_slug: string;
  source: "meta_leadform" | "meta_whatsapp";
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
  converted_at: string;
  raw_payload: Record<string, unknown>;
}

function normalizeAccountId(id: string): string {
  return id.startsWith("act_") ? id : `act_${id}`;
}

function buildUrl(path: string, params: Record<string, string>, token: string): string {
  const url = new URL(`${META_API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  return url.toString();
}

async function metaFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Meta API ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json() as Promise<T>;
}

async function fetchAllPages<T>(initialUrl: string): Promise<T[]> {
  const results: T[] = [];
  let url: string | undefined = initialUrl;
  while (url) {
    const page: MetaPage<T> = await metaFetch<MetaPage<T>>(url);
    results.push(...page.data);
    url = page.paging?.next;
  }
  return results;
}

// Lead forms são da Page, não da ad account. Fluxo:
//   1. /{account_id}/promote_pages → pages associadas à conta
//   2. /{page_id}?fields=access_token → Page Access Token (System User precisa ter acesso à page)
//   3. /{page_id}/leadgen_forms (com pageToken) → forms
//   4. /{form_id}/leads (com pageToken) → leads

interface MetaAccountPage { id: string; name: string }

async function fetchAccountPages(accountId: string, token: string): Promise<MetaAccountPage[]> {
  const url = buildUrl(`/${accountId}/promote_pages`, { fields: "id,name", limit: "200" }, token);
  return fetchAllPages<MetaAccountPage>(url);
}

async function fetchPageAccessToken(pageId: string, token: string): Promise<string | null> {
  const url = buildUrl(`/${pageId}`, { fields: "access_token" }, token);
  try {
    const res = await metaFetch<{ access_token?: string }>(url);
    return res.access_token ?? null;
  } catch {
    return null;
  }
}

async function fetchLeadFormsForPage(pageId: string, pageToken: string): Promise<MetaLeadForm[]> {
  const url = buildUrl(
    `/${pageId}/leadgen_forms`,
    { fields: "id,name,status", limit: "200" },
    pageToken,
  );
  return fetchAllPages<MetaLeadForm>(url);
}

async function fetchLeadsForForm(formId: string, pageToken: string, sinceUnix: number): Promise<MetaLead[]> {
  const url = buildUrl(
    `/${formId}/leads`,
    {
      fields: "id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,platform",
      limit: "100",
      filtering: JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: sinceUnix }]),
    },
    pageToken,
  );
  return fetchAllPages<MetaLead>(url);
}

function pickField(l: MetaLead, candidates: string[]): string | null {
  for (const fd of l.field_data ?? []) {
    const key = (fd.name ?? "").toLowerCase();
    if (candidates.some(c => key === c || key.includes(c))) {
      const v = fd.values?.[0];
      if (v && v.trim()) return v.trim();
    }
  }
  return null;
}

function mapLead(l: MetaLead, clientSlug: string): MappedLead {
  const platform = (l.platform ?? "").toLowerCase();
  return {
    client_slug: clientSlug,
    source: "meta_leadform",
    lead_email:   pickField(l, ["email", "e-mail"]),
    lead_name:    pickField(l, ["full_name", "name", "nome"]),
    lead_phone:   pickField(l, ["phone_number", "phone", "telefone", "celular", "whatsapp"]),
    lead_company: pickField(l, ["company_name", "company", "empresa"]),
    conversion_event: l.form_id ? `meta_form_${l.form_id}` : (l.ad_name ?? null),
    landing_page: null,
    utm_source:   platform === "instagram" ? "instagram" : "facebook",
    utm_medium:   "paid",
    utm_campaign: l.campaign_name ?? null,
    utm_content:  l.ad_name ?? null,
    utm_term:     null,
    converted_at: l.created_time,
    raw_payload:  l as unknown as Record<string, unknown>,
  };
}

export interface SyncMetaLeadsResult {
  forms: number;
  formsOk: number;
  formsFailed: number;
  leads: MappedLead[];
  errors: { form_id: string; form_name: string; error: string }[];
}

// ─── Click-to-WhatsApp / Messenger conversations ──────────────────────────────
// Ads de mensagens reportam o resultado como `onsite_conversion.messaging_conversation_started_7d`
// nas insights ad-level. Tratamos cada conversa como um lead sintético (source='meta_whatsapp')
// pra somar com Lead Forms na contagem do dashboard.

interface MetaAdInsightWithActions {
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  date_start: string;
  actions?: { action_type: string; value: string }[];
}

async function fetchAdInsightsWithActions(
  accountId: string,
  token: string,
  sinceISO: string,
  untilISO: string,
): Promise<MetaAdInsightWithActions[]> {
  const timeRange = JSON.stringify({ since: sinceISO.slice(0, 10), until: untilISO.slice(0, 10) });
  const url = buildUrl(
    `/${accountId}/insights`,
    {
      level: "ad",
      fields: "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,date_start,actions",
      time_range: timeRange,
      time_increment: "1",
      limit: "500",
    },
    token,
  );
  return fetchAllPages<MetaAdInsightWithActions>(url);
}

// Conta conversas WhatsApp por (ad_id, date) somando apenas action_types relevantes,
// preferindo o `messaging_conversation_started_7d` (o que aparece como "Resultado" no Ads Manager).
function countWhatsAppConversations(actions: { action_type: string; value: string }[] | undefined): number {
  if (!actions?.length) return 0;
  const startedAction = actions.find(a => a.action_type === "onsite_conversion.messaging_conversation_started_7d");
  if (startedAction) return parseInt(startedAction.value, 10) || 0;
  // Fallback: first_reply (raramente difere; mais seguro pra contas que não emitem o evento de "started")
  const firstReply = actions.find(a => a.action_type === "onsite_conversion.messaging_first_reply");
  if (firstReply) return parseInt(firstReply.value, 10) || 0;
  return 0;
}

export interface SyncMetaWhatsappResult {
  adsScanned: number;
  conversationsTotal: number;
  leads: MappedLead[];
}

export async function syncMetaWhatsappForAccount(
  accountId: string,
  clientSlug: string,
  token: string,
  sinceISO: string,
  untilISO: string,
): Promise<SyncMetaWhatsappResult> {
  const norm = normalizeAccountId(accountId);
  const rows = await fetchAdInsightsWithActions(norm, token, sinceISO, untilISO);

  const leads: MappedLead[] = [];
  let total = 0;

  for (const row of rows) {
    const count = countWhatsAppConversations(row.actions);
    if (count <= 0) continue;
    total += count;
    // Cria N leads sintéticos (1 por conversa). lead_email determinístico garante
    // idempotência via UNIQUE (client_slug, source, lead_email, conversion_event, converted_at).
    const adId = row.ad_id ?? "";
    const date = row.date_start; // YYYY-MM-DD
    // Materializa no início do dia em UTC pra `converted_at` ser estável entre syncs.
    const convertedAt = `${date}T00:00:00.000Z`;
    for (let i = 0; i < count; i++) {
      leads.push({
        client_slug: clientSlug,
        source: "meta_whatsapp",
        lead_email: `wpp_${adId}_${date}_${i + 1}`, // pseudo-email único pro unique constraint
        lead_name: null,
        lead_phone: null,
        lead_company: null,
        conversion_event: "whatsapp_conversation",
        landing_page: null,
        utm_source: "facebook",
        utm_medium: "paid",
        utm_campaign: row.campaign_name ?? null,
        utm_content: row.ad_name ?? null,
        utm_term: null,
        converted_at: convertedAt,
        raw_payload: {
          ad_id: adId,
          ad_name: row.ad_name,
          campaign_id: row.campaign_id,
          campaign_name: row.campaign_name,
          adset_id: row.adset_id,
          date,
          conversation_index: i + 1,
        },
      });
    }
  }

  return { adsScanned: rows.length, conversationsTotal: total, leads };
}


export async function syncMetaLeadsForAccount(
  accountId: string,
  clientSlug: string,
  token: string,
  sinceISO: string,
): Promise<SyncMetaLeadsResult> {
  const norm = normalizeAccountId(accountId);
  const sinceUnix = Math.floor(new Date(sinceISO).getTime() / 1000);

  const leads: MappedLead[] = [];
  const errors: SyncMetaLeadsResult["errors"] = [];
  let ok = 0;
  let totalForms = 0;

  // 1. Pages associadas à conta
  let pages: MetaAccountPage[] = [];
  try {
    pages = await fetchAccountPages(norm, token);
  } catch (err) {
    errors.push({ form_id: "(account)", form_name: "promote_pages", error: String(err) });
    return { forms: 0, formsOk: 0, formsFailed: errors.length, leads, errors };
  }

  // 2. Pra cada page, obter Page Access Token + listar lead forms + puxar leads
  for (const page of pages) {
    const pageToken = await fetchPageAccessToken(page.id, token);
    if (!pageToken) {
      errors.push({
        form_id: page.id,
        form_name: `page:${page.name}`,
        error: "Sem access_token (System User não tem permissão na page?)",
      });
      continue;
    }

    let pageForms: MetaLeadForm[] = [];
    try {
      pageForms = await fetchLeadFormsForPage(page.id, pageToken);
    } catch (err) {
      errors.push({ form_id: page.id, form_name: `page:${page.name}`, error: String(err) });
      continue;
    }

    totalForms += pageForms.length;

    for (const form of pageForms) {
      try {
        const formLeads = await fetchLeadsForForm(form.id, pageToken, sinceUnix);
        for (const l of formLeads) leads.push(mapLead(l, clientSlug));
        ok++;
      } catch (err) {
        errors.push({ form_id: form.id, form_name: form.name, error: String(err) });
      }
    }
  }

  return { forms: totalForms, formsOk: ok, formsFailed: errors.length, leads, errors };
}
