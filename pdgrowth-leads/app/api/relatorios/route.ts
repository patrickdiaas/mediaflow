import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { filterCampaignLeads, isCampaignLead } from "@/lib/leads-filter";
import { buildAttributionIndex, attributeLead, fetchAliases, fetchEventMaps } from "@/lib/campaign-attribution";
import { calcBudgetPacing, type BudgetPacingResult } from "@/lib/budget-pacing";

export const maxDuration = 60;

function fmt(n: number) { return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtInt(n: number) { return n.toLocaleString("pt-BR"); }
function pct(n: number, d: number = 2) { return `${n.toFixed(d)}%`; }

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

type ReportType = "semanal" | "quinzenal" | "mensal";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function ymd(d: Date) { return d.toISOString().split("T")[0]; }
function parseYmd(s: string) { return new Date(s + "T12:00:00"); }
function brDate(s: string) { const d = parseYmd(s); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`; }
function brDateFull(s: string) { const d = parseYmd(s); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; }

// Buckets do comparativo semanal mudam por tipo de relatório:
// - "semanal": 1 bucket qui→ter (snap na última terça <= periodTo).
// - "quinzenal" / "mensal": semanas COMPLETAS de 7 dias começando do
//   periodFrom, contadas como "Sem 1, Sem 2, ..." do período. Cobre dia
//   a dia sem buracos. O último bucket pode ser parcial (< 7 dias) e
//   leva o sufixo "(parcial)" no label.
function buildWeekBuckets(
  periodFrom: string,
  periodTo: string,
  reportType: ReportType,
): { since: string; until: string; label: string; partial?: boolean }[] {
  const fromD = parseYmd(periodFrom), toD = parseYmd(periodTo);

  if (reportType === "semanal") {
    const lastTue = new Date(toD);
    while (lastTue.getDay() !== 2) lastTue.setDate(lastTue.getDate() - 1);
    const since = new Date(lastTue); since.setDate(since.getDate() - 5);
    if (since < fromD) {
      // Sem terça inteira no range — usa o range exato como bucket único.
      return [{ since: periodFrom, until: periodTo, label: `${brDate(periodFrom)} a ${brDate(periodTo)}` }];
    }
    return [{ since: ymd(since), until: ymd(lastTue), label: `${brDate(ymd(since))} a ${brDate(ymd(lastTue))}` }];
  }

  // Mensal/quinzenal: 7 em 7 a partir de periodFrom, cobrindo todo o range.
  const buckets: { since: string; until: string; label: string; partial?: boolean }[] = [];
  const cursor = new Date(fromD);
  while (cursor <= toD) {
    const since = new Date(cursor);
    const until = new Date(cursor);
    until.setDate(until.getDate() + 6);
    const partial = until > toD;
    if (partial) until.setTime(toD.getTime());
    buckets.push({
      since: ymd(since),
      until: ymd(until),
      label: `${brDate(ymd(since))} a ${brDate(ymd(until))}${partial ? " (parcial)" : ""}`,
      partial,
    });
    cursor.setDate(cursor.getDate() + 7);
  }
  return buckets;
}

function monthBoundary(untilStr: string): { since: string; until: string; daysInMonth: number; daysElapsed: number } {
  const u = parseYmd(untilStr);
  const since = new Date(u.getFullYear(), u.getMonth(), 1);
  const daysInMonth = new Date(u.getFullYear(), u.getMonth() + 1, 0).getDate();
  const daysElapsed = u.getDate();
  return { since: ymd(since), until: untilStr, daysInMonth, daysElapsed };
}

function previousMonthSameWindow(currentSince: string, currentUntil: string): { since: string; until: string } {
  const sCur = parseYmd(currentSince), uCur = parseYmd(currentUntil);
  const sPrev = new Date(sCur.getFullYear(), sCur.getMonth() - 1, sCur.getDate());
  const uPrev = new Date(uCur.getFullYear(), uCur.getMonth() - 1, uCur.getDate());
  return { since: ymd(sPrev), until: ymd(uPrev) };
}

function deltaPct(curr: number, prev: number): string {
  if (prev === 0 && curr === 0) return "—";
  if (prev === 0) return curr > 0 ? "+∞" : "—";
  const d = ((curr - prev) / prev) * 100;
  const sign = d > 0 ? "+" : "";
  return `${sign}${d.toFixed(1)}%`;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

interface RangeStats {
  leads: number;
  metaLeads: number;
  googleLeads: number;
  spend: number;
  metaSpend: number;
  googleSpend: number;
  cpl: number;
  metaCpl: number;
  googleCpl: number;
  impressions: number;
  clicks: number;
  ctr: number;
}

function inRange(dateStr: string, since: string, until: string) {
  return dateStr >= since && dateStr <= until;
}

function computeRangeStats(
  leads: any[],
  ads: any[],
  since: string,
  until: string,
  leadConvertedKey: "converted_at" | "_brt_date" = "_brt_date"
): RangeStats {
  const leadsInRange = leads.filter(l => {
    const d = leadConvertedKey === "_brt_date" ? l._brt_date : (l.converted_at as string).slice(0, 10);
    return inRange(d, since, until);
  });
  const adsInRange = ads.filter(a => inRange(a.date, since, until));

  // Cada lead vem com _platform pré-calculado (utm_source OU plataforma da
  // campanha atribuída via event_map/alias quando utm_source não bate).
  const metaLeads = leadsInRange.filter(l => l._platform === "meta");
  const googleLeads = leadsInRange.filter(l => l._platform === "google");

  const totalSpend = adsInRange.reduce((s, r) => s + Number(r.spend), 0);
  const totalImp = adsInRange.reduce((s, r) => s + Number(r.impressions), 0);
  const totalClk = adsInRange.reduce((s, r) => s + Number(r.clicks), 0);
  const metaSpend = adsInRange.filter(a => a.platform === "meta").reduce((s, r) => s + Number(r.spend), 0);
  const googleSpend = adsInRange.filter(a => a.platform === "google").reduce((s, r) => s + Number(r.spend), 0);

  return {
    leads: leadsInRange.length,
    metaLeads: metaLeads.length,
    googleLeads: googleLeads.length,
    spend: totalSpend,
    metaSpend,
    googleSpend,
    cpl: leadsInRange.length > 0 && totalSpend > 0 ? totalSpend / leadsInRange.length : 0,
    metaCpl: metaLeads.length > 0 && metaSpend > 0 ? metaSpend / metaLeads.length : 0,
    googleCpl: googleLeads.length > 0 && googleSpend > 0 ? googleSpend / googleLeads.length : 0,
    impressions: totalImp,
    clicks: totalClk,
    ctr: totalImp > 0 ? (totalClk / totalImp) * 100 : 0,
  };
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { client, period_from, period_to, reportType } = await req.json() as {
      client: string; period_from: string; period_to: string; reportType: ReportType;
    };

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada." }, { status: 500 });
    if (!client || !period_from || !period_to) return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });

    const supabase = createServiceClient();
    const periodFrom = period_from.slice(0, 10);
    const periodTo = period_to.slice(0, 10);

    // Janelas auxiliares
    const monthCur = monthBoundary(periodTo);
    const monthPrev = previousMonthSameWindow(monthCur.since, monthCur.until);
    // Comparativo semanal: para semanal, 1 bucket qui→ter. Para mensal/
    // quinzenal, sempre cobre do dia 1 do mês até `until`, contando
    // semanas completas de 7 dias.
    const weeks = buildWeekBuckets(monthCur.since, periodTo, reportType);

    // Range mais antigo necessário para uma única busca
    const fetchSince = [periodFrom, monthCur.since, monthPrev.since].sort()[0];
    const fetchUntil = periodTo;

    // BRT adjustment para leads (converted_at é UTC; BRT = UTC-3)
    const leadFetchSince = `${fetchSince}T03:00:00`;
    const fetchUntilNext = new Date(fetchUntil + "T00:00:00Z");
    fetchUntilNext.setUTCDate(fetchUntilNext.getUTCDate() + 1);
    const leadFetchUntil = `${fetchUntilNext.toISOString().split("T")[0]}T02:59:59`;

    // ── Event maps + Leads ──────────────────────────────────────────────────
    const eventMaps = await fetchEventMaps(supabase, client);
    const mappedEventsSet = new Set(eventMaps.map(e => e.conversion_event));
    const mappedEventsList = Array.from(mappedEventsSet);

    const leadsQ = supabase
      .from("leads")
      .select("id, converted_at, source, conversion_event, utm_source, utm_medium, utm_campaign, utm_content, utm_term")
      .eq("client_slug", client)
      .gte("converted_at", leadFetchSince)
      .lte("converted_at", leadFetchUntil);
    const { data: leadsRaw } = await filterCampaignLeads(leadsQ, mappedEventsList);
    const allLeads = (leadsRaw ?? []).filter((l: any) => isCampaignLead(l, mappedEventsSet)).map((l: any) => {
      // Pré-calcula data BRT (YYYY-MM-DD)
      const u = new Date(l.converted_at);
      u.setUTCHours(u.getUTCHours() - 3);
      return { ...l, _brt_date: u.toISOString().split("T")[0] };
    });

    // ── Ad campaigns ────────────────────────────────────────────────────────
    const { data: adCampaignsRaw } = await supabase
      .from("ad_campaigns")
      .select("campaign_id, campaign_name, platform, date, impressions, clicks, spend, reach")
      .eq("client_slug", client)
      .gte("date", fetchSince)
      .lte("date", fetchUntil);
    const allAdCampaigns = adCampaignsRaw ?? [];

    // ── Aliases cadastrados pelo gestor ────────────────────────────────────
    const aliases = await fetchAliases(supabase, client);

    // ── Inferir plataforma de cada lead ────────────────────────────────────
    // Quando utm_source não bate com facebook/google (caso de event_map ou UTM perdida),
    // usamos a plataforma da campanha que o lead foi atribuído.
    const campNameToPlatform = new Map<string, "meta" | "google">();
    const campNameToIds = new Map<string, Set<string>>();
    for (const c of allAdCampaigns) {
      if (c.platform === "meta" || c.platform === "google") campNameToPlatform.set(c.campaign_name, c.platform);
      if (c.campaign_id) {
        const s = campNameToIds.get(c.campaign_name) ?? new Set<string>();
        s.add(c.campaign_id);
        campNameToIds.set(c.campaign_name, s);
      }
    }
    const globalIndex = buildAttributionIndex(
      Array.from(campNameToPlatform.keys()).map(name => ({ campaign_name: name, campaign_ids: campNameToIds.get(name) ?? new Set() })),
      aliases,
      eventMaps,
    );
    for (const l of allLeads) {
      const s = (l.utm_source ?? "").toLowerCase();
      if (s === "facebook" || s === "fb" || s === "instagram" || s === "ig" || s === "facebook ads") {
        (l as any)._platform = "meta";
      } else if (s === "google") {
        (l as any)._platform = "google";
      } else {
        const r = attributeLead(l.utm_campaign, globalIndex, l.conversion_event);
        if (r.campaign_name) {
          const p = campNameToPlatform.get(r.campaign_name);
          if (p) (l as any)._platform = p;
        }
      }
    }

    // ── Ações do gestor no período (criativos novos, otimizações, pausas) ──
    const { data: actionsRaw } = await supabase
      .from("report_actions")
      .select("action_date, platform, campaign_name, title, description")
      .eq("client_slug", client)
      .gte("action_date", periodFrom)
      .lte("action_date", periodTo)
      .order("action_date", { ascending: true });
    const reportActions = actionsRaw ?? [];

    // ── Stats por janela ────────────────────────────────────────────────────
    const weekStats = weeks.map(w => ({ ...w, stats: computeRangeStats(allLeads, allAdCampaigns, w.since, w.until) }));
    const monthCurStats = computeRangeStats(allLeads, allAdCampaigns, monthCur.since, monthCur.until);
    const monthPrevStats = computeRangeStats(allLeads, allAdCampaigns, monthPrev.since, monthPrev.until);

    // Run-rate do mês corrente
    const runRate = monthCur.daysElapsed > 0 ? {
      leads: Math.round((monthCurStats.leads / monthCur.daysElapsed) * monthCur.daysInMonth),
      spend: (monthCurStats.spend / monthCur.daysElapsed) * monthCur.daysInMonth,
    } : { leads: 0, spend: 0 };

    // ── Pacing de orçamento (mês corrente) ──────────────────────────────────
    // Usa o YYYY-MM derivado de monthCur.until. Busca os budgets cadastrados
    // pelo gestor (Total / Meta / Google) e calcula real × previsto.
    const yearMonthKey = monthCur.until.slice(0, 7);
    const { data: budgetsRaw } = await supabase
      .from("client_budgets")
      .select("platform, budget, front_half_pct")
      .eq("client_slug", client)
      .eq("year_month", yearMonthKey);
    const pacingByPlatform: { total?: BudgetPacingResult; meta?: BudgetPacingResult; google?: BudgetPacingResult } = {};
    for (const b of budgetsRaw ?? []) {
      const plat = b.platform as "total" | "meta" | "google";
      const realSpend = plat === "total" ? monthCurStats.spend : plat === "meta" ? monthCurStats.metaSpend : monthCurStats.googleSpend;
      pacingByPlatform[plat] = calcBudgetPacing({
        budget: Number(b.budget),
        frontHalfPct: Number(b.front_half_pct),
        daysInMonth: monthCur.daysInMonth,
        dayOfMonth: monthCur.daysElapsed,
        realSpend,
      });
    }
    const hasPacing = Object.keys(pacingByPlatform).length > 0;

    // ── Período principal (= range escolhido pelo usuário; é o período do detalhamento) ──
    const mainStats = computeRangeStats(allLeads, allAdCampaigns, periodFrom, periodTo);
    const mainLeads = allLeads.filter((l: any) => inRange(l._brt_date, periodFrom, periodTo));
    const mainAds = allAdCampaigns.filter((a: any) => inRange(a.date, periodFrom, periodTo));

    // Forms do período
    const formMap = new Map<string, number>();
    for (const l of mainLeads) formMap.set(l.conversion_event ?? "desconhecido", (formMap.get(l.conversion_event ?? "desconhecido") ?? 0) + 1);
    const topForms = Array.from(formMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

    // Aggregate de campanhas (período principal)
    const campAgg = new Map<string, { name: string; platform: string; campaignIds: Set<string>; spend: number; impressions: number; clicks: number; reach: number; leads: number }>();
    for (const c of mainAds) {
      const key = c.campaign_name;
      const e = campAgg.get(key) ?? { name: c.campaign_name, platform: c.platform, campaignIds: new Set(), spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0 };
      e.spend += Number(c.spend); e.impressions += Number(c.impressions); e.clicks += Number(c.clicks); e.reach += Number(c.reach);
      if (c.campaign_id) e.campaignIds.add(c.campaign_id);
      campAgg.set(key, e);
    }
    // Constrói índice de atribuição (exato → id → alias → fuzzy → event)
    const campIndex = buildAttributionIndex(
      Array.from(campAgg.values()).map(c => ({ campaign_name: c.name, campaign_ids: c.campaignIds })),
      aliases,
      eventMaps,
    );

    // Atribui leads à campanha + identifica leads "sem match"
    // Agrupa por (utm_campaign + conversion_event) pra que leads sem utm_campaign
    // ainda apareçam separados por formulário/LP de origem (identificação útil).
    const unmatchedLeadsMap = new Map<string, { utm_campaign: string; conversion_event: string; utm_source: string | null; utm_content: string | null; count: number }>();
    for (const l of mainLeads) {
      const result = attributeLead(l.utm_campaign, campIndex, l.conversion_event);
      if (result.campaign_name) {
        campAgg.get(result.campaign_name)!.leads++;
        continue;
      }
      const ev = l.conversion_event ?? "(sem evento)";
      const camp = l.utm_campaign ?? "(sem utm_campaign)";
      const key = `${camp}::${ev}`;
      const ex = unmatchedLeadsMap.get(key) ?? { utm_campaign: camp, conversion_event: ev, utm_source: l.utm_source, utm_content: l.utm_content, count: 0 };
      ex.count++; unmatchedLeadsMap.set(key, ex);
    }
    const unmatchedLeads = Array.from(unmatchedLeadsMap.values()).sort((a, b) => b.count - a.count).slice(0, 20);

    const campaignRows = Array.from(campAgg.values())
      .map(c => ({ ...c, ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0, cpl: c.leads > 0 ? c.spend / c.leads : null }))
      .sort((a, b) => (b.leads || 0) - (a.leads || 0));

    // ── Criativos do período principal ──────────────────────────────────────
    const { data: adCreativesRaw } = await supabase
      .from("ad_creatives")
      .select("ad_id, ad_name, campaign_name, platform, creative_type, headline, permalink_url, impressions, clicks, spend")
      .eq("client_slug", client)
      .gte("date", periodFrom)
      .lte("date", periodTo);
    const adCreatives = adCreativesRaw ?? [];

    const creativeAgg = new Map<string, { name: string; campaign: string; platform: string; type: string | null; headline: string | null; permalink: string | null; spend: number; impressions: number; clicks: number; leads: number }>();
    for (const c of adCreatives) {
      const e = creativeAgg.get(c.ad_id) ?? { name: c.ad_name, campaign: c.campaign_name ?? "", platform: c.platform, type: c.creative_type, headline: c.headline, permalink: c.permalink_url ?? null, spend: 0, impressions: 0, clicks: 0, leads: 0 };
      e.spend += Number(c.spend); e.impressions += Number(c.impressions); e.clicks += Number(c.clicks);
      creativeAgg.set(c.ad_id, e);
    }
    const dominantCreative = new Map<string, string>();
    for (const [, c] of Array.from(creativeAgg.entries())) {
      const cur = dominantCreative.get(c.campaign);
      const curEntry = cur ? Array.from(creativeAgg.values()).find(x => x.name === cur) : null;
      if (!cur || c.spend > (curEntry?.spend ?? 0)) dominantCreative.set(c.campaign, c.name);
    }
    for (const l of mainLeads) {
      let matched = false;
      // Tenta primeiro por utm_term (nome do criativo)
      if (l.utm_term) {
        for (const [, e] of Array.from(creativeAgg.entries())) {
          if (e.name === l.utm_term || fuzzyMatch(e.name, l.utm_term)) { e.leads++; matched = true; break; }
        }
      }
      // Fallback: criativo dominante da campanha atribuída (inclui leads sem utm_term,
      // recuperados via event_map/alias). Garante que soma dos criativos = total da campanha.
      if (!matched) {
        const r = attributeLead(l.utm_campaign, campIndex, l.conversion_event);
        if (r.campaign_name) {
          const domName = dominantCreative.get(r.campaign_name);
          if (domName) {
            const dom = Array.from(creativeAgg.values()).find(c => c.name === domName);
            if (dom) dom.leads++;
          }
        }
      }
    }
    const allCreativesWithSpend = Array.from(creativeAgg.values())
      .map(c => ({ ...c, ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0, cpl: c.leads > 0 ? c.spend / c.leads : null }))
      .filter(c => c.spend > 0).sort((a, b) => b.leads - a.leads || b.spend - a.spend);
    const creativesByCampaign = new Map<string, typeof allCreativesWithSpend>();
    for (const c of allCreativesWithSpend) {
      if (!creativesByCampaign.has(c.campaign)) creativesByCampaign.set(c.campaign, []);
      creativesByCampaign.get(c.campaign)!.push(c);
    }

    // ── Keywords + search terms do período principal ────────────────────────
    const { data: kwData } = await supabase
      .from("keywords").select("keyword_text, campaign_name, match_type, impressions, clicks, spend, conversions")
      .eq("client_slug", client).gte("date", periodFrom).lte("date", periodTo);
    const kwAgg = new Map<string, { campaign: string; matchType: string; clicks: number; spend: number; conversions: number }>();
    for (const k of (kwData ?? [])) {
      if (!k.keyword_text) continue;
      const e = kwAgg.get(k.keyword_text) ?? { campaign: k.campaign_name ?? "", matchType: k.match_type ?? "", clicks: 0, spend: 0, conversions: 0 };
      e.clicks += Number(k.clicks); e.spend += Number(k.spend ?? 0); e.conversions += Number(k.conversions ?? 0);
      kwAgg.set(k.keyword_text, e);
    }
    const topKw = Array.from(kwAgg.entries()).map(([text, v]) => ({ text, ...v })).sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks).slice(0, 15);

    const { data: stData } = await supabase
      .from("search_terms").select("search_term, campaign_name, impressions, clicks, spend, conversions")
      .eq("client_slug", client).gte("date", periodFrom).lte("date", periodTo);
    const stAgg = new Map<string, { campaign: string; clicks: number; spend: number; conversions: number }>();
    for (const s of (stData ?? [])) {
      if (!s.search_term) continue;
      const e = stAgg.get(s.search_term) ?? { campaign: s.campaign_name ?? "", clicks: 0, spend: 0, conversions: 0 };
      e.clicks += Number(s.clicks); e.spend += Number(s.spend ?? 0); e.conversions += Number(s.conversions ?? 0);
      stAgg.set(s.search_term, e);
    }
    const topSt = Array.from(stAgg.entries()).map(([term, v]) => ({ term, ...v })).sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks).slice(0, 15);

    // Placements do período principal
    const { data: plcData } = await supabase
      .from("ad_placements").select("placement, impressions, clicks, spend, conversions")
      .eq("client_slug", client).gte("date", periodFrom).lte("date", periodTo);
    const plcAgg = new Map<string, { impressions: number; clicks: number; spend: number; conversions: number }>();
    for (const p of (plcData ?? [])) {
      const e = plcAgg.get(p.placement) ?? { impressions: 0, clicks: 0, spend: 0, conversions: 0 };
      e.impressions += Number(p.impressions); e.clicks += Number(p.clicks); e.spend += Number(p.spend); e.conversions += Number(p.conversions ?? 0);
      plcAgg.set(p.placement, e);
    }
    const topPlacements = Array.from(plcAgg.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.conversions - a.conversions).slice(0, 6);

    // Formulários por campanha (última semana)
    const formsByCampaign = new Map<string, Map<string, number>>();
    for (const l of mainLeads) {
      const camp = l.utm_campaign ?? "(sem campanha)";
      const form = l.conversion_event ?? "desconhecido";
      if (!formsByCampaign.has(camp)) formsByCampaign.set(camp, new Map());
      const fMap = formsByCampaign.get(camp)!;
      fMap.set(form, (fMap.get(form) ?? 0) + 1);
    }

    // ── KPIs (para card no front) ────────────────────────────────────────────
    const kpis = {
      leads: mainStats.leads,
      metaLeads: mainStats.metaLeads,
      googleLeads: mainStats.googleLeads,
      spend: mainStats.spend,
      metaSpend: mainStats.metaSpend,
      googleSpend: mainStats.googleSpend,
      cpl: mainStats.cpl,
      metaCpl: mainStats.metaCpl,
      googleCpl: mainStats.googleCpl,
      impressions: mainStats.impressions,
      clicks: mainStats.clicks,
      ctr: mainStats.ctr,
    };

    // ── Build context para Claude ────────────────────────────────────────────
    const periodLabel = `${brDateFull(periodFrom)} a ${brDateFull(periodTo)}`;
    const typeLabel = reportType === "semanal" ? "Semanal" : reportType === "quinzenal" ? "Quinzenal" : "Mensal";

    // Bloco 1: tabela comparativa semanal
    const weeklyTableContext = weeks.length > 1 ? `
COMPARATIVO SEMANAL (semana mais antiga → mais recente):
${weekStats.map((w, i) => {
  const prev = i > 0 ? weekStats[i - 1].stats : null;
  return [
    `Semana ${i + 1} — ${w.label}`,
    `  TOTAL:  Leads ${w.stats.leads}${prev ? ` (Δ ${deltaPct(w.stats.leads, prev.leads)})` : ""} | Invest R$${fmt(w.stats.spend)}${prev ? ` (Δ ${deltaPct(w.stats.spend, prev.spend)})` : ""} | CPL ${w.stats.cpl > 0 ? `R$${fmt(w.stats.cpl)}` : "—"}${prev && prev.cpl > 0 ? ` (Δ ${deltaPct(w.stats.cpl, prev.cpl)})` : ""} | CTR ${pct(w.stats.ctr)}${prev ? ` (Δ ${deltaPct(w.stats.ctr, prev.ctr)})` : ""}`,
    `  META:   ${w.stats.metaLeads} leads | R$${fmt(w.stats.metaSpend)} | CPL ${w.stats.metaCpl > 0 ? `R$${fmt(w.stats.metaCpl)}` : "—"}${prev && prev.metaCpl > 0 ? ` (Δ ${deltaPct(w.stats.metaCpl, prev.metaCpl)})` : ""}`,
    `  GOOGLE: ${w.stats.googleLeads} leads | R$${fmt(w.stats.googleSpend)} | CPL ${w.stats.googleCpl > 0 ? `R$${fmt(w.stats.googleCpl)}` : "—"}${prev && prev.googleCpl > 0 ? ` (Δ ${deltaPct(w.stats.googleCpl, prev.googleCpl)})` : ""}`,
  ].join("\n");
}).join("\n\n")}
`.trim() : "";

    // Bloco 2: mês corrente vs mês anterior + run-rate
    const monthlyContext = `
MÊS CORRENTE — ${brDateFull(monthCur.since)} a ${brDateFull(monthCur.until)} (dia ${monthCur.daysElapsed} de ${monthCur.daysInMonth}):
- TOTAL:  Leads ${monthCurStats.leads} | Invest R$${fmt(monthCurStats.spend)} | CPL ${monthCurStats.cpl > 0 ? `R$${fmt(monthCurStats.cpl)}` : "—"} | CTR ${pct(monthCurStats.ctr)}
- META:   ${monthCurStats.metaLeads} leads | R$${fmt(monthCurStats.metaSpend)} | CPL ${monthCurStats.metaCpl > 0 ? `R$${fmt(monthCurStats.metaCpl)}` : "—"}
- GOOGLE: ${monthCurStats.googleLeads} leads | R$${fmt(monthCurStats.googleSpend)} | CPL ${monthCurStats.googleCpl > 0 ? `R$${fmt(monthCurStats.googleCpl)}` : "—"}

MÊS ANTERIOR (mesmo intervalo) — ${brDateFull(monthPrev.since)} a ${brDateFull(monthPrev.until)}:
- TOTAL:  Leads ${monthPrevStats.leads} | Invest R$${fmt(monthPrevStats.spend)} | CPL ${monthPrevStats.cpl > 0 ? `R$${fmt(monthPrevStats.cpl)}` : "—"} | CTR ${pct(monthPrevStats.ctr)}
- META:   ${monthPrevStats.metaLeads} leads | R$${fmt(monthPrevStats.metaSpend)} | CPL ${monthPrevStats.metaCpl > 0 ? `R$${fmt(monthPrevStats.metaCpl)}` : "—"}
- GOOGLE: ${monthPrevStats.googleLeads} leads | R$${fmt(monthPrevStats.googleSpend)} | CPL ${monthPrevStats.googleCpl > 0 ? `R$${fmt(monthPrevStats.googleCpl)}` : "—"}

VARIAÇÃO MÊS A MÊS (corrente vs anterior — mesmo intervalo de dias):
- TOTAL  → Leads: ${deltaPct(monthCurStats.leads, monthPrevStats.leads)} | Invest: ${deltaPct(monthCurStats.spend, monthPrevStats.spend)} | CPL: ${deltaPct(monthCurStats.cpl, monthPrevStats.cpl)} | CTR: ${deltaPct(monthCurStats.ctr, monthPrevStats.ctr)}
- META   → Leads: ${deltaPct(monthCurStats.metaLeads, monthPrevStats.metaLeads)} | Invest: ${deltaPct(monthCurStats.metaSpend, monthPrevStats.metaSpend)} | CPL: ${deltaPct(monthCurStats.metaCpl, monthPrevStats.metaCpl)}
- GOOGLE → Leads: ${deltaPct(monthCurStats.googleLeads, monthPrevStats.googleLeads)} | Invest: ${deltaPct(monthCurStats.googleSpend, monthPrevStats.googleSpend)} | CPL: ${deltaPct(monthCurStats.googleCpl, monthPrevStats.googleCpl)}

PROJEÇÃO DO MÊS (run-rate, ritmo atual extrapolado para ${monthCur.daysInMonth} dias):
- Leads projetados: ${runRate.leads} | Investimento projetado: R$${fmt(runRate.spend)}
`.trim();

    // Bloco 2.b: pacing de orçamento (só se houver budget cadastrado)
    const pacingLabel = (s: string) =>
      s === "over" ? "ACIMA DO RITMO (>20%)"
      : s === "slightly_over" ? "Levemente acima (>10%)"
      : s === "on_track" ? "No ritmo"
      : s === "slightly_under" ? "Levemente abaixo (<10%)"
      : "ATRASADO (<20%)";
    const pacingContext = hasPacing ? `
PACING DE ORÇAMENTO — ${yearMonthKey} (dia ${monthCur.daysElapsed} de ${monthCur.daysInMonth}):
${(["total", "meta", "google"] as const)
  .filter(k => pacingByPlatform[k])
  .map(k => {
    const p = pacingByPlatform[k]!;
    const label = k === "total" ? "TOTAL " : k === "meta" ? "META  " : "GOOGLE";
    const pctReal = p.expectedSpendByEom > 0 ? (p.realSpend / p.expectedSpendByEom) * 100 : 0;
    return [
      `- ${label}: R$${fmt(p.realSpend)} de R$${fmt(p.expectedSpendByEom)} (${pctReal.toFixed(1)}% do orçamento) — ${pacingLabel(p.status)}`,
      `         Previsto até hoje pela estratégia: R$${fmt(p.expectedSpend)} | Restante: R$${fmt(p.remaining)} em ${p.daysRemaining}d | Recomendado/dia: R$${fmt(p.recommendedDailySpend)}`,
    ].join("\n");
  }).join("\n")}
`.trim() : "";

    // Bloco 3: detalhamento do PERÍODO PRINCIPAL (range escolhido pelo usuário)
    const metaCampaigns = campaignRows.filter(c => c.platform === "meta");
    const googleCampaigns = campaignRows.filter(c => c.platform === "google");

    const mainDetailContext = `
DETALHAMENTO DO PERÍODO (${brDateFull(periodFrom)} a ${brDateFull(periodTo)}):
- Total: ${mainLeads.length} leads | R$${fmt(mainAds.reduce((s, a) => s + Number(a.spend), 0))} invest
- Formulários (top 10): ${topForms.map(([f, n]) => `${f} (${n})`).join(", ")}

${metaCampaigns.length > 0 ? `META ADS — POR CAMPANHA:
${metaCampaigns.filter(c => c.leads > 0 || c.spend > 50).map(c => {
  const creatives = creativesByCampaign.get(c.name) ?? [];
  const forms = formsByCampaign.get(c.name);
  const formsStr = forms ? Array.from(forms.entries()).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f}(${n})`).join(", ") : "";
  return [
    `  CAMPANHA: ${c.name}`,
    `    Gasto: R$${fmt(c.spend)} | Impressões: ${fmtInt(c.impressions)} | Cliques: ${fmtInt(c.clicks)} | CTR: ${pct(c.ctr)}`,
    `    Leads: ${c.leads}${c.cpl ? ` | CPL: R$${fmt(c.cpl)}` : ""}`,
    formsStr ? `    Formulários: ${formsStr}` : "",
    creatives.length > 0 ? `    Criativos:\n${creatives.map(cr => `      - ${cr.name} | R$${fmt(cr.spend)} | ${cr.leads} leads | CTR ${pct(cr.ctr)}${cr.cpl ? ` | CPL R$${fmt(cr.cpl)}` : ""}${cr.permalink ? ` | ${cr.permalink}` : ""}`).join("\n")}` : "",
  ].filter(Boolean).join("\n");
}).join("\n\n")}${topPlacements.length > 0 ? `\n\n  POSICIONAMENTOS:\n${topPlacements.map(p => `    ${p.name}: ${p.conversions} conv | ${fmtInt(p.clicks)} cliques | R$${fmt(p.spend)}`).join("\n")}` : ""}` : ""}

${googleCampaigns.length > 0 ? `GOOGLE ADS — POR CAMPANHA:
${googleCampaigns.filter(c => c.leads > 0 || c.spend > 50).map(c => [
  `  CAMPANHA: ${c.name}`,
  `    Gasto: R$${fmt(c.spend)} | Impressões: ${fmtInt(c.impressions)} | Cliques: ${fmtInt(c.clicks)} | CTR: ${pct(c.ctr)}`,
  `    Leads: ${c.leads}${c.cpl ? ` | CPL: R$${fmt(c.cpl)}` : ""}`,
].join("\n")).join("\n\n")}

  TOP PALAVRAS-CHAVE:
${topKw.slice(0, 10).map((k, i) => `    ${i + 1}. "${k.text}" [${k.matchType}] | ${k.clicks} cliques | ${k.conversions.toFixed(0)} conv | CPC R$${k.clicks > 0 ? fmt(k.spend / k.clicks) : "—"}`).join("\n")}

  TOP TERMOS DE PESQUISA:
${topSt.slice(0, 10).map((s, i) => `    ${i + 1}. "${s.term}" | ${s.clicks} cliques | ${s.conversions.toFixed(0)} conv`).join("\n")}` : ""}
`.trim();

    // Bloco 4: leads pagos sem campanha atribuída
    const unmatchedContext = unmatchedLeads.length > 0 ? `
LEADS PAGOS SEM CAMPANHA ATRIBUÍDA (período principal):
${unmatchedLeads.map(u => `  - formulário="${u.conversion_event}" | utm_campaign="${u.utm_campaign}" | source=${u.utm_source ?? "?"} | content=${u.utm_content ?? "?"} | ${u.count} lead(s)`).join("\n")}
Total: ${unmatchedLeads.reduce((s, u) => s + u.count, 0)} leads pagos não conseguiram ser atribuídos a nenhuma campanha do Meta/Google sincronizada (UTMs divergentes ou tráfego institucional). Cadastre aliases em Configurações para resolver.
`.trim() : "";

    // Bloco 5: ações realizadas pelo gestor no período (cadastradas previamente)
    const actionsContext = reportActions.length > 0 ? `
AÇÕES REALIZADAS PELO GESTOR NO PERÍODO (cadastradas previamente, devem entrar como seção dedicada):
${reportActions.map((a: any) => {
  const platLabel = a.platform === "meta" ? "Meta" : a.platform === "google" ? "Google" : "Geral";
  const camp = a.campaign_name ? ` | ${a.campaign_name}` : "";
  return `  - ${a.action_date} | ${platLabel}${camp} | ${a.title}: ${a.description}`;
}).join("\n")}
`.trim() : "";

    const context = [weeklyTableContext, monthlyContext, pacingContext, mainDetailContext, unmatchedContext, actionsContext].filter(Boolean).join("\n\n");

    // ── Prompts ──────────────────────────────────────────────────────────────
    const systemPrompt = `Você é o gestor de tráfego sênior redigindo um relatório de performance para apresentar ao cliente e à equipe na reunião semanal.

REGRAS CRÍTICAS:
- USE APENAS os dados fornecidos. NUNCA invente números, metas ou projeções.
- O relatório deve começar com DADOS e NÚMEROS completos, depois análise.
- Seja DETALHADO — cada campanha merece análise completa.
- Tom profissional e estratégico. Você está mostrando resultados do SEU trabalho.
- Destaque conquistas e resultados positivos primeiro.
- Pontos de atenção devem ser apresentados como OPORTUNIDADES DE MELHORIA, não como erros.
- NÃO use linguagem que sugira falha do gestor (ex: "precisa verificar rastreamento", "pode haver erro").
- Quando uma campanha não converte, foque na oportunidade: "campanha em fase de aprendizado", "oportunidade de otimização", "teste em andamento".
- NÃO inclua seções de recomendações de criativos, cronograma ou próximos passos.
- Use subtítulos descritivos (### Título Claro), nunca ### com emoji sozinho.

QUANDO HOUVER COMPARATIVO SEMANAL:
- Sempre apresente uma TABELA com colunas: Semana | Leads | Δ Leads | Invest | Δ Invest | CPL | Δ CPL | CTR | Δ CTR.
- Sempre QUEBRE também por plataforma (Meta e Google) em sub-tabelas separadas.
- Comente as variações que mais chamam atenção em texto curto APÓS a tabela.

QUANDO HOUVER MÊS CORRENTE vs ANTERIOR:
- Apresente como bloco separado, com a comparação direta e a projeção do mês.
- Cite explicitamente que o mês anterior foi truncado no mesmo dia para tornar o comparativo justo.`;

    // Constrói as seções dinamicamente — opcionais entram só quando há dados.
    const sections: [string, string][] = [
      ["Overview do Período",
        "Resumo direto com números gerais do período: total de leads, investimento, CPL geral. Quebra por plataforma (Meta vs Google) com leads/invest/CPL de cada. Liste os formulários que mais receberam leads."],
      ["Comparativo Semanal",
        weeks.length > 1
          ? "Apresente UMA tabela com TODAS as semanas no formato: Semana | Período | Leads | Δ% | Invest | Δ% | CPL | Δ% | CTR | Δ% (a primeira semana não tem Δ). Logo abaixo, repita o exercício com sub-tabelas por plataforma (Meta e Google). Após as tabelas, em 3-4 frases, comente as principais variações entre semanas — onde houve aceleração, onde houve atenção."
          : "Período principal cabe em uma única semana. Apresente os números agregados sem tabela comparativa entre semanas."],
      ["Mês Corrente e Projeção",
        `Apresente o acumulado do mês corrente até a data de fechamento e a comparação com o MESMO INTERVALO do mês anterior. Inclua a projeção (run-rate) para o fechamento do mês.

Use TABELA com colunas: Plataforma | Leads (corrente) | Leads (anterior) | Δ Leads | Invest (corrente) | Invest (anterior) | Δ Invest | CPL (corrente) | CPL (anterior) | Δ CPL. Linhas: TOTAL, Meta, Google. TODAS as linhas DEVEM ter valores do mês anterior preenchidos — estão em "MÊS ANTERIOR" e em "VARIAÇÃO MÊS A MÊS". Não deixe Meta/Google com "—" no anterior.

Após a tabela, mostre a projeção (run-rate). Comente em 2-3 frases se o ritmo está acima ou abaixo do mês anterior.`],
    ];

    if (hasPacing) {
      sections.push(["Pacing do Orçamento",
        `Os dados estão em "PACING DE ORÇAMENTO" no contexto. Apresente uma TABELA com colunas: Plataforma | Gasto Real | Orçamento | % Realizado | Previsto até hoje | Status | Recomendado/dia. Linhas devem ser exatamente as plataformas que aparecem no contexto (TOTAL/META/GOOGLE). Use os status como vieram (ex: "No ritmo", "Levemente acima", "ATRASADO"). Após a tabela, comente em 2-3 frases se o cliente está no ritmo da estratégia ou se precisa ajustar (acelerar/conter). Cite o "Recomendado/dia" como guia prático para os dias restantes do mês. NÃO recomende mudar o orçamento — só apontar a velocidade.`]);
    }

    sections.push(["Meta Ads — Resultados por Campanha (período " + brDateFull(periodFrom) + " a " + brDateFull(periodTo) + ")",
      metaCampaigns.length > 0
        ? "Para CADA campanha Meta com investimento ou leads no período selecionado, apresente: investimento, leads, CPL, CTR. Abaixo de cada campanha, liste TODOS os criativos com gasto (mesmo os com zero leads) com: nome, gasto, leads, CTR, CPL e link. Mencione posicionamentos que mais converteram. Os números devem refletir TODO o período selecionado, não apenas a semana mais recente."
        : "Sem campanhas Meta no período."]);

    sections.push(["Google Ads — Resultados por Campanha (período " + brDateFull(periodFrom) + " a " + brDateFull(periodTo) + ")",
      googleCampaigns.length > 0
        ? "Para CADA campanha Google com investimento ou leads no período selecionado, apresente: investimento, leads, CPL, CTR. Liste as top palavras-chave com cliques e conversões. Liste os termos de pesquisa mais relevantes. Destaque termos com alta conversão e termos que gastam sem converter. Os números devem refletir TODO o período selecionado, não apenas a semana mais recente."
        : "Sem campanhas Google no período."]);

    if (unmatchedLeads.length > 0) {
      sections.push(["Leads Pagos Sem Campanha Atribuída",
        "Apresente uma TABELA com colunas: Formulário | utm_campaign | Source | Quantidade. Use os dados do bloco 'LEADS PAGOS SEM CAMPANHA ATRIBUÍDA' do contexto. A coluna Formulário deve mostrar o conversion_event (que identifica a LP/formulário de origem). Max 15 linhas. Em 2 frases, sugira ações: cadastrar mapeamento LP→Campanha em Configurações para LPs de conteúdo (resolve retroativamente), revisar tagueamento das origens onde a UTM se perde, conferir UTMs no RD."]);
    }

    if (reportActions.length > 0) {
      sections.push(["Ações Realizadas pelo Gestor no Período",
        "Liste as ações cadastradas no contexto, agrupadas por plataforma (Meta primeiro, depois Google, depois Geral). Para cada ação, mostre data, campanha (se houver) e descrição. Use tabela ou bullets organizados. NÃO invente ações além das listadas no contexto."]);
    }

    sections.push(["Destaques e Pontos de Atenção",
      "O que funcionou bem? O que precisa de atenção? Quais campanhas/criativos devem ser escalados e quais devem ser revisados? Use os dados das semanas e do mês para justificar."]);

    const sectionsBlock = sections.map(([title, instr], i) => `**${i + 1}. ${title}**\n${instr}`).join("\n\n");

    const userPrompt = `Gere um relatório ${typeLabel.toLowerCase()} de performance para reunião com cliente. Período principal: ${periodLabel}.

DADOS:
${context}

Escreva o relatório EXATAMENTE neste formato:

${sectionsBlock}

NÃO inclua seções de recomendações de criativos, cronograma de produção ou próximos passos.

IMPORTANTE sobre formatação:
- Tabelas comparativas usam markdown padrão com pipes |.
- Use ### para subtítulos dentro das seções.
- NÃO use ### sozinho com emojis — escreva o texto descritivo completo.`;

    return NextResponse.json({ context, kpis, reportType, systemPrompt, userPrompt, step: "data" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erro interno." }, { status: 500 });
  }
}
