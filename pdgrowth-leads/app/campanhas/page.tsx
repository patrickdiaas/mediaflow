"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import DataTable, { Column } from "@/components/data-table";

// Extrai palavras significativas de um nome (remove pontuação, lowercase)
function extractWords(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(w => w.length > 1);
}

// Match inteligente: compara palavras significativas entre dois nomes
function fuzzyMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const al = a.toLowerCase(), bl = b.toLowerCase();
  if (al.includes(bl) || bl.includes(al)) return true;
  const aWords = extractWords(a);
  const bWords = extractWords(b);
  if (aWords.length === 0 || bWords.length === 0) return false;
  const [smaller, larger] = aWords.length <= bWords.length ? [aWords, bWords] : [bWords, aWords];
  return smaller.length >= 1 && smaller.every(w => larger.includes(w));
}
import { useDashboard } from "@/lib/dashboard-context";
import type { CampaignRow, AdSetRow, CreativeRow, Platform, FunnelStep } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { filterCampaignLeads } from "@/lib/leads-filter";
import { buildAttributionIndex, attributeLead, type CampaignAlias, type EventToCampaign } from "@/lib/campaign-attribution";
import { getPeriodDates, getLeadDates } from "@/lib/period";
import Funnel from "@/components/funnel";
import Image from "next/image";

type Tab = "campanhas" | "conjuntos" | "anuncios";

const PlatformBadge = ({ p }: { p: Platform }) => (
  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${
    p === "meta" ? "text-blue border-blue/30 bg-blue/10" : "text-gold border-gold/30 bg-gold/10"
  }`}>
    {p === "meta" ? "Meta" : "Google"}
  </span>
);

const cplColor = (v: number) =>
  v > 0 && v <= 15 ? "text-accent" : v <= 30 ? "text-gold" : "text-red";

const campaignColumns: Column<CampaignRow>[] = [
  { key: "campaign_name", label: "Campanha",
    render: (v, row) => (
      <div className="flex items-center gap-2">
        <PlatformBadge p={row.platform} />
        <span className="text-text-primary text-sm truncate max-w-xs" title={String(v)}>{String(v)}</span>
      </div>
    ) },
  { key: "impressions", label: "Impressões", align: "right", render: v => Number(v).toLocaleString("pt-BR") },
  { key: "clicks",      label: "Cliques",    align: "right", render: v => Number(v).toLocaleString("pt-BR") },
  { key: "ctr",         label: "CTR",        align: "right", render: v => <span className="text-text-secondary">{Number(v).toFixed(1)}%</span> },
  { key: "spend",       label: "Investido",  align: "right", render: v => <span className="text-blue">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "leads",       label: "Leads",      align: "right", render: v => <span className="text-accent font-semibold">{String(v)}</span> },
  { key: "cpl",         label: "CPL",        align: "right", render: v => { const n = Number(v); return n > 0 ? <span className={`font-semibold ${cplColor(n)}`}>R$ {n.toFixed(2)}</span> : <span className="text-text-muted">—</span>; } },
];

const adSetColumns: Column<AdSetRow>[] = [
  { key: "ad_set_name", label: "Conjunto",
    render: (v, row) => (
      <div>
        <div className="flex items-center gap-2 mb-0.5"><PlatformBadge p={row.platform} /><span className="text-text-primary text-sm">{String(v)}</span></div>
        <span className="text-xs text-text-muted">{row.campaign_name}</span>
      </div>
    ) },
  { key: "impressions", label: "Impressões", align: "right", render: v => Number(v).toLocaleString("pt-BR") },
  { key: "clicks",      label: "Cliques",    align: "right", render: v => Number(v).toLocaleString("pt-BR") },
  { key: "ctr",         label: "CTR",        align: "right", render: v => <span className="text-text-secondary">{Number(v).toFixed(1)}%</span> },
  { key: "spend",       label: "Investido",  align: "right", render: v => <span className="text-blue">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "leads",       label: "Leads",      align: "right", render: v => <span className="text-accent font-semibold">{String(v)}</span> },
  { key: "cpl",         label: "CPL",        align: "right", render: v => { const n = Number(v); return n > 0 ? <span className={`font-semibold ${cplColor(n)}`}>R$ {n.toFixed(2)}</span> : <span className="text-text-muted">—</span>; } },
];

const adColumns: Column<CreativeRow>[] = [
  { key: "ad_name", label: "Anúncio",
    render: (v, row) => (
      <div className="flex items-center gap-3">
        <div className="relative w-14 h-9 rounded-md overflow-hidden bg-bg flex-shrink-0 border border-border">
          {row.thumbnail_url
            ? <Image src={row.thumbnail_url} alt={String(v)} fill className="object-cover" sizes="56px" unoptimized />
            : <div className="w-full h-full flex items-center justify-center text-text-muted text-[10px]">—</div>}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-0.5"><PlatformBadge p={row.platform} /><span className="text-text-primary text-sm">{String(v)}</span></div>
          <span className="text-xs text-text-muted">{row.campaign_name}</span>
        </div>
      </div>
    ) },
  { key: "impressions", label: "Impressões", align: "right", render: v => Number(v).toLocaleString("pt-BR") },
  { key: "clicks",      label: "Cliques",    align: "right", render: v => Number(v).toLocaleString("pt-BR") },
  { key: "ctr",         label: "CTR",        align: "right", render: v => <span className="text-text-secondary">{Number(v).toFixed(1)}%</span> },
  { key: "spend",       label: "Investido",  align: "right", render: v => <span className="text-blue">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "leads",       label: "Leads",      align: "right", render: v => <span className="text-accent font-semibold">{String(v)}</span> },
  { key: "cpl",         label: "CPL",        align: "right", render: v => { const n = Number(v); return n > 0 ? <span className={`font-semibold ${cplColor(n)}`}>R$ {n.toFixed(2)}</span> : <span className="text-text-muted">—</span>; } },
];

type StatusFilter = "active" | "all";

export default function CampanhasPage() {
  const { platform, period, client } = useDashboard();
  const [tab, setTab] = useState<Tab>("campanhas");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [adSets, setAdSets] = useState<AdSetRow[]>([]);
  const [ads, setAds] = useState<CreativeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [funnelSteps, setFunnelSteps] = useState<FunnelStep[]>([]);
  const [funnelMetrics, setFunnelMetrics] = useState<{ cpm: number; ctr: number; pageConvRate: number | null; checkoutConvRate: number | null; overallConvRate: number } | null>(null);
  const [allCampRowsRef, setAllCampRowsRef] = useState<any[]>([]);
  const [allLeadsRef, setAllLeadsRef] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { since, until } = getPeriodDates(period);
      const { since: leadSince, until: leadUntil } = getLeadDates(period);
      setLoading(true);
      const metaSlug = client !== "all" ? client : null;

      // Busca event maps primeiro pra incluir leads sem UTM com event mapeado
      const evMapQ = metaSlug
        ? supabase.from("event_to_campaign").select("conversion_event, target_campaign_name").eq("client_slug", metaSlug)
        : supabase.from("event_to_campaign").select("conversion_event, target_campaign_name");
      const { data: evMapData } = await evMapQ;
      const eventMaps = (evMapData ?? []) as EventToCampaign[];
      const eventList = eventMaps.map(e => e.conversion_event);

      const baseCamp = supabase.from("ad_campaigns").select("campaign_id,campaign_name,platform,status,impressions,clicks,spend,landing_page_views,lead_form_submissions").gte("date", since).lte("date", until);
      const baseSets = supabase.from("ad_sets").select("ad_set_id,ad_set_name,campaign_name,platform,status,impressions,clicks,spend").gte("date", since).lte("date", until);
      const baseAds  = supabase.from("ad_creatives").select("ad_id,ad_name,campaign_name,platform,status,creative_type,thumbnail_url,video_url,permalink_url,headline,impressions,clicks,spend,frequency,placement").gte("date", since).lte("date", until);

      const qCamp = metaSlug ? (platform !== "all" ? baseCamp.eq("platform", platform) : baseCamp).eq("client_slug", metaSlug) : (platform !== "all" ? baseCamp.eq("platform", platform) : baseCamp);
      const qSets = metaSlug ? (platform !== "all" ? baseSets.eq("platform", platform) : baseSets).eq("client_slug", metaSlug) : (platform !== "all" ? baseSets.eq("platform", platform) : baseSets);
      const qAds  = metaSlug ? (platform !== "all" ? baseAds.eq("platform", platform) : baseAds).eq("client_slug", metaSlug) : (platform !== "all" ? baseAds.eq("platform", platform) : baseAds);

      const baseLeads = supabase.from("leads").select("id, conversion_event, utm_source, utm_medium, utm_campaign, utm_content, utm_term").gte("converted_at", leadSince).lte("converted_at", leadUntil);
      const filteredLeads = filterCampaignLeads(baseLeads, eventList);
      const qLeads = metaSlug ? filteredLeads.eq("client_slug", metaSlug) : filteredLeads;

      const aliasQ = metaSlug
        ? supabase.from("campaign_aliases").select("alias_utm_campaign, target_campaign_name").eq("client_slug", metaSlug)
        : supabase.from("campaign_aliases").select("alias_utm_campaign, target_campaign_name");

      Promise.all([qCamp, qSets, qAds, qLeads, aliasQ]).then(([campRes, setsRes, adsRes, leadsRes, aliasRes]) => {
        if (cancelled) return;
        const aliases = (aliasRes.data ?? []) as CampaignAlias[];
      const allLeadsData = leadsRes.data ?? [];
      // Filtra leads pela plataforma selecionada
      const leadsData = platform === "all" ? allLeadsData : allLeadsData.filter((l: any) => {
        const src = (l.utm_source ?? "").toLowerCase();
        if (platform === "meta") return src === "facebook" || src === "fb" || src === "instagram" || src === "ig";
        if (platform === "google") return src === "google";
        return true;
      });
      setAllCampRowsRef(campRes.data ?? []);
      setAllLeadsRef(leadsData);

      // Mapeamento UTM → Meta Ads:
      // utm_campaign = nome da campanha
      // utm_content  = nome do conjunto de anúncios
      // utm_term     = nome do anúncio/criativo
      const byCampaign = new Map<string, number>();
      const byAdSet    = new Map<string, number>();
      const byAdName   = new Map<string, number>();
      for (const l of leadsData) {
        if (l.utm_campaign) byCampaign.set(l.utm_campaign, (byCampaign.get(l.utm_campaign) ?? 0) + 1);
        if (l.utm_content) byAdSet.set(l.utm_content, (byAdSet.get(l.utm_content) ?? 0) + 1);
        if (l.utm_term) byAdName.set(l.utm_term, (byAdName.get(l.utm_term) ?? 0) + 1);
      }

      setLoading(false);

      // Campanhas
      if (campRes.data && campRes.data.length > 0) {
        const map = new Map<string, CampaignRow>();
        for (const r of campRes.data) {
          const key = `${r.platform}:${r.campaign_id}`;
          const ex = map.get(key);
          if (ex) { ex.impressions += r.impressions ?? 0; ex.clicks += r.clicks ?? 0; ex.spend += r.spend ?? 0; }
          else { map.set(key, { campaign_id: r.campaign_id, campaign_name: r.campaign_name, platform: r.platform as Platform, status: r.status ?? "", impressions: r.impressions ?? 0, clicks: r.clicks ?? 0, spend: r.spend ?? 0, leads: 0, cpl: 0, ctr: 0 }); }
        }
        // Atribui cada lead a no máximo 1 campanha (exato → id → alias → fuzzy → event)
        const campRows = Array.from(map.values());
        const campIndex = buildAttributionIndex(
          campRows.map(c => ({ campaign_name: c.campaign_name, campaign_id: c.campaign_id })),
          aliases,
          eventMaps,
        );
        const leadsPerCamp = new Map<string, number>();
        for (const l of leadsData) {
          const r = attributeLead(l.utm_campaign, campIndex, l.conversion_event);
          if (r.campaign_name) leadsPerCamp.set(r.campaign_name, (leadsPerCamp.get(r.campaign_name) ?? 0) + 1);
        }
        setCampaigns(campRows.map(c => {
          const ld = leadsPerCamp.get(c.campaign_name) ?? 0;
          return { ...c, ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0, leads: ld, cpl: ld > 0 ? c.spend / ld : 0 };
        }));
      } else { setCampaigns([]); }

      // Conjuntos
      if (setsRes.data && setsRes.data.length > 0) {
        const map = new Map<string, AdSetRow>();
        for (const r of setsRes.data) {
          const key = `${r.platform}:${r.ad_set_id}`;
          const ex = map.get(key);
          if (ex) { ex.impressions += r.impressions ?? 0; ex.clicks += r.clicks ?? 0; ex.spend += r.spend ?? 0; }
          else { map.set(key, { ad_set_id: r.ad_set_id, ad_set_name: r.ad_set_name, campaign_name: r.campaign_name ?? "", platform: r.platform as Platform, impressions: r.impressions ?? 0, clicks: r.clicks ?? 0, spend: r.spend ?? 0, leads: 0, cpl: 0, ctr: 0 }); }
        }
        setAdSets(Array.from(map.values()).map(c => {
          let ld = byAdSet.get(c.ad_set_name) ?? 0;
          if (ld === 0) {
            for (const [utmVal, count] of Array.from(byAdSet.entries())) {
              if (fuzzyMatch(c.ad_set_name, utmVal)) { ld += count; }
            }
          }
          return { ...c, ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0, leads: ld, cpl: ld > 0 ? c.spend / ld : 0 };
        }));
      } else { setAdSets([]); }

      // Anúncios
      if (adsRes.data && adsRes.data.length > 0) {
        const map = new Map<string, CreativeRow>();
        for (const r of adsRes.data) {
          const key = `${r.platform}:${r.ad_id}`;
          const ex = map.get(key);
          if (ex) { ex.impressions += r.impressions ?? 0; ex.clicks += r.clicks ?? 0; ex.spend += r.spend ?? 0; }
          else { map.set(key, { ad_id: r.ad_id, ad_name: r.ad_name, campaign_name: r.campaign_name ?? "", platform: r.platform as Platform, creative_type: r.creative_type ?? null, thumbnail_url: r.thumbnail_url ?? null, video_url: r.video_url ?? null, permalink_url: r.permalink_url ?? null, headline: r.headline ?? null, placement: r.placement ?? null, impressions: r.impressions ?? 0, clicks: r.clicks ?? 0, spend: r.spend ?? 0, frequency: r.frequency ?? null, leads: 0, cpl: 0, ctr: 0, cpm: 0, video_3s_rate: null, video_thruplay_rate: null }); }
        }
        setAds(Array.from(map.values()).map(c => {
          let ld = byAdName.get(c.ad_name) ?? 0;
          if (ld === 0) {
            for (const [utmVal, count] of Array.from(byAdName.entries())) {
              if (fuzzyMatch(c.ad_name, utmVal)) { ld += count; }
            }
          }
          return { ...c, ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0, cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0, leads: ld, cpl: ld > 0 ? c.spend / ld : 0 };
        }));
      } else { setAds([]); }
      });
    })();
    return () => { cancelled = true; };
  }, [platform, period, client]);

  // Funil: Impressões → Cliques → View Página → Formulário → Leads
  useEffect(() => {
    if (allCampRowsRef.length === 0) { setFunnelSteps([]); setFunnelMetrics(null); return; }
    const filteredRows = selectedCampaign === "all" ? allCampRowsRef : allCampRowsRef.filter((r: any) => r.campaign_name === selectedCampaign);
    const filteredLeads = selectedCampaign === "all" ? allLeadsRef : allLeadsRef.filter((l: any) => {
      return fuzzyMatch(l.utm_campaign ?? "", selectedCampaign);
    });

    const imp = filteredRows.reduce((s: number, r: any) => s + (r.impressions ?? 0), 0);
    const clk = filteredRows.reduce((s: number, r: any) => s + (r.clicks ?? 0), 0);
    const lpv = filteredRows.reduce((s: number, r: any) => s + (r.landing_page_views ?? 0), 0);
    const lfs = filteredRows.reduce((s: number, r: any) => s + (r.lead_form_submissions ?? 0), 0);
    const spd = filteredRows.reduce((s: number, r: any) => s + (r.spend ?? 0), 0);
    const lds = filteredLeads.length;

    if (imp === 0 && clk === 0 && lds === 0) { setFunnelSteps([]); setFunnelMetrics(null); return; }

    const steps: FunnelStep[] = [
      { label: "Impressões", value: imp },
      { label: "Cliques", value: clk, rate: imp > 0 ? (clk / imp) * 100 : 0 },
      ...(lpv > 0 ? [{ label: "View de página", value: lpv, rate: clk > 0 ? (lpv / clk) * 100 : 0 }] : []),
      ...(lfs > 0 ? [{ label: "Formulário", value: lfs, rate: (lpv > 0 ? lpv : clk) > 0 ? (lfs / (lpv > 0 ? lpv : clk)) * 100 : 0 }] : []),
      { label: "Leads (UTM)", value: lds, rate: (lfs > 0 ? lfs : lpv > 0 ? lpv : clk) > 0 ? (lds / (lfs > 0 ? lfs : lpv > 0 ? lpv : clk)) * 100 : 0 },
    ];

    setFunnelSteps(steps);
    setFunnelMetrics({
      cpm: imp > 0 ? (spd / imp) * 1000 : 0,
      ctr: imp > 0 ? (clk / imp) * 100 : 0,
      pageConvRate: lpv > 0 ? (lds / lpv) * 100 : null,
      checkoutConvRate: lfs > 0 ? (lds / lfs) * 100 : null,
      overallConvRate: clk > 0 ? (lds / clk) * 100 : 0,
    });
  }, [selectedCampaign, allCampRowsRef, allLeadsRef]);

  const isActive = (s: string) => !s || s === "ACTIVE" || s === "ENABLED";
  const statusCampaigns = statusFilter === "active" ? campaigns.filter(c => isActive(c.status) || c.spend > 0) : campaigns;
  const filteredCampaigns = selectedCampaign === "all" ? statusCampaigns : statusCampaigns.filter(c => c.campaign_name === selectedCampaign);
  const activeCampNames = new Set(statusCampaigns.map(c => c.campaign_name));
  const filteredAdSets = (selectedCampaign === "all" ? adSets : adSets.filter(c => c.campaign_name === selectedCampaign)).filter(c => statusFilter === "all" || activeCampNames.has(c.campaign_name));
  const filteredAds = (selectedCampaign === "all" ? ads : ads.filter(c => c.campaign_name === selectedCampaign)).filter(c => statusFilter === "all" || activeCampNames.has(c.campaign_name));
  const activeData = tab === "campanhas" ? filteredCampaigns : tab === "conjuntos" ? filteredAdSets : filteredAds;
  const campaignOptions = ["all", ...Array.from(new Set(statusCampaigns.map(c => c.campaign_name)))];
  const totalSpend = activeData.reduce((s, c) => s + c.spend, 0);
  const totalLeads = activeData.reduce((s, c) => s + c.leads, 0);
  const overallCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

  const tabs: { id: Tab; label: string }[] = [
    { id: "campanhas", label: "Campanhas" },
    { id: "conjuntos", label: "Conjuntos" },
    { id: "anuncios",  label: "Anúncios"  },
  ];

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-h-0 p-4 md:p-6 overflow-y-auto">
        <Header title="Campanhas" subtitle="Performance por campanha, conjunto e anúncio" />
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl px-2 py-1.5">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? "bg-accent/10 text-accent border border-accent/20" : "text-text-secondary hover:text-text-primary"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <select value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent/40 cursor-pointer font-mono">
            <option value="all">Todas as campanhas</option>
            {campaignOptions.filter(c => c !== "all").map(c => (<option key={c} value={c}>{c}</option>))}
          </select>
          <div className="flex items-center bg-card border border-border rounded-lg overflow-hidden text-xs font-medium">
            <button onClick={() => setStatusFilter("active")}
              className={`px-3 py-1.5 transition-colors ${statusFilter === "active" ? "bg-accent/10 text-accent" : "text-text-secondary hover:text-text-primary"}`}>
              Ativas
            </button>
            <button onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 transition-colors ${statusFilter === "all" ? "bg-accent/10 text-accent" : "text-text-secondary hover:text-text-primary"}`}>
              Todas
            </button>
          </div>
        </div>

        <div className="flex gap-4 mb-5 p-3 bg-card border border-border rounded-xl text-sm flex-wrap">
          <Stat label="Investimento" value={`R$ ${totalSpend.toLocaleString("pt-BR")}`} color="text-blue" />
          <div className="w-px bg-border" />
          <Stat label="Leads" value={String(totalLeads)} color="text-accent" />
          <div className="w-px bg-border" />
          <Stat label="CPL Geral" value={overallCpl > 0 ? `R$ ${overallCpl.toFixed(2)}` : "—"} color={overallCpl > 0 ? cplColor(overallCpl) : "text-text-muted"} />
        </div>

        {loading ? (
          <div className="text-text-secondary text-sm py-8 text-center">Carregando...</div>
        ) : (
          <>
            {tab === "campanhas" && (
              <div className="space-y-5">
                <DataTable<CampaignRow> columns={campaignColumns} data={filteredCampaigns} rowKey="campaign_id" />
                {funnelSteps.length > 0 && <Funnel steps={funnelSteps} metrics={funnelMetrics} />}
              </div>
            )}
            {tab === "conjuntos" && <DataTable<AdSetRow> columns={adSetColumns} data={filteredAdSets} rowKey="ad_set_id" />}
            {tab === "anuncios" && <DataTable<CreativeRow> columns={adColumns} data={filteredAds} rowKey="ad_id" />}
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-text-muted text-xs">{label}:</span>
      <span className={`font-mono font-semibold text-sm ${color}`}>{value}</span>
    </div>
  );
}
