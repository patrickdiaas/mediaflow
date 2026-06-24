// Meta Lead Ads (Instant Forms) — puxa leads via Graph API e mapeia pra tabela `leads`.
// Usado por clientes que capturam leads direto no Meta (sem RD Station no meio).
//
// Fluxo:
//   1. /{ad_account_id}/leadgen_forms → lista formulários da conta
//   2. /{form_id}/leads?filtering=[{field:"time_created",operator:"GREATER_THAN",value:<unix>}]
//   3. Mapeia field_data → colunas da tabela `leads` (email, name, phone, company)
//   4. Preenche utm_campaign com campaign_name pra atribuição casar com ad_campaigns
//
// Permissão necessária no token: leads_retrieval (admin/advertiser da page que possui o form).

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
  source: "meta_leadform";
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

async function fetchLeadForms(accountId: string, token: string): Promise<MetaLeadForm[]> {
  const url = buildUrl(
    `/${accountId}/leadgen_forms`,
    { fields: "id,name,status,page{id,name}", limit: "200" },
    token,
  );
  return fetchAllPages<MetaLeadForm>(url);
}

async function fetchLeadsForForm(formId: string, token: string, sinceUnix: number): Promise<MetaLead[]> {
  const url = buildUrl(
    `/${formId}/leads`,
    {
      fields: "id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,platform",
      limit: "100",
      filtering: JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: sinceUnix }]),
    },
    token,
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

export async function syncMetaLeadsForAccount(
  accountId: string,
  clientSlug: string,
  token: string,
  sinceISO: string,
): Promise<SyncMetaLeadsResult> {
  const norm = normalizeAccountId(accountId);
  const forms = await fetchLeadForms(norm, token);
  const sinceUnix = Math.floor(new Date(sinceISO).getTime() / 1000);

  const leads: MappedLead[] = [];
  const errors: SyncMetaLeadsResult["errors"] = [];
  let ok = 0;

  for (const form of forms) {
    try {
      const formLeads = await fetchLeadsForForm(form.id, token, sinceUnix);
      for (const l of formLeads) leads.push(mapLead(l, clientSlug));
      ok++;
    } catch (err) {
      errors.push({ form_id: form.id, form_name: form.name, error: String(err) });
    }
  }

  return { forms: forms.length, formsOk: ok, formsFailed: errors.length, leads, errors };
}
