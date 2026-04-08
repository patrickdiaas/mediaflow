"use client";
import { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";
import KPICard from "@/components/kpi-card";
import DualAxisChart from "@/components/dual-axis-chart";
import DonutChart from "@/components/donut-chart";
import HorizontalBar from "@/components/horizontal-bar";
import DataTable, { Column } from "@/components/data-table";
import Funnel from "@/components/funnel";
import { useDashboard } from "@/lib/dashboard-context";
import { supabase } from "@/lib/supabase";
import { getPeriodDates, getLeadDates, toBRTDate } from "@/lib/period";
import type { Platform, KPIData, DonutSlice, HorizontalBarItem, TrendPoint, RegionRow, FunnelStep } from "@/lib/types";
import { RefreshCw, Calendar, Building2, Menu, Megaphone, Trophy } from "lucide-react";

// ─── Fuzzy match (same as campanhas/criativos) ─────────────────────────────
function fuzzyMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const aParts = a.split("-");
  const bParts = b.split("-");
  const [smaller, larger] = aParts.length <= bParts.length ? [aParts, bParts] : [bParts, aParts];
  return smaller.length >= 2 && smaller.every(p => larger.includes(p));
}

const periods = [
  { value: "today",     label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "last7",     label: "Últimos 7 dias" },
  { value: "last30",    label: "Últimos 30 dias" },
  { value: "thisMonth", label: "Este mês" },
  { value: "lastMonth", label: "Mês passado" },
];

const CHART_COLORS = ["#CAFF04", "#60A5FA", "#F59E0B", "#EF4444", "#A78BFA", "#34D399"];

const PLACEMENT_LABELS: Record<string, string> = {
  facebook_feed: "Feed", facebook_story: "Stories", facebook_reels: "Reels",
  facebook_right_hand_column: "Coluna Direita", facebook_video_feeds: "Vídeos",
  facebook_marketplace: "Marketplace", facebook_search: "Busca FB",
  instagram_feed: "IG Feed", instagram_story: "IG Stories", instagram_reels: "IG Reels",
  instagram_explore: "IG Explorar", instagram_profile_feed: "IG Perfil",
  audience_network_classic: "Audience Network", messenger_inbox: "Messenger",
};
function formatPlacement(raw: string): string {
  return PLACEMENT_LABELS[raw] ?? raw.replace(/_/g, " ");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
interface LeadStats {
  leads: number;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  landingPageViews: number;
  leadFormSubmissions: number;
}

function buildKPIs(stats: LeadStats, loading: boolean): KPIData[] {
  const f = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cpl = stats.leads > 0 && stats.spend > 0 ? stats.spend / stats.leads : 0;
  const ctr = stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0;
  const cpc = stats.clicks > 0 ? stats.spend / stats.clicks : 0;
  const cpm = stats.impressions > 0 ? (stats.spend / stats.impressions) * 1000 : 0;
  const convRate = stats.clicks > 0 ? (stats.leads / stats.clicks) * 100 : 0;
  return [
    { label: "Leads",           value: loading ? "…" : String(stats.leads),                               color: "accent" },
    { label: "CPL",             value: loading ? "…" : cpl > 0 ? `R$ ${f(cpl)}` : "—",                   color: "gold"   },
    { label: "Investimento",    value: loading ? "…" : stats.spend > 0 ? `R$ ${f(stats.spend)}` : "—",   color: "blue"   },
    { label: "Impressões",      value: loading ? "…" : stats.impressions.toLocaleString("pt-BR"),         color: "blue"   },
    { label: "Cliques",         value: loading ? "…" : stats.clicks.toLocaleString("pt-BR"),              color: "blue"   },
    { label: "CTR",             value: loading ? "…" : `${ctr.toFixed(2)}%`,                              color: "blue"   },
    { label: "CPC",             value: loading ? "…" : cpc > 0 ? `R$ ${f(cpc)}` : "—",                   color: "gold"   },
    { label: "CPM",             value: loading ? "…" : cpm > 0 ? `R$ ${f(cpm)}` : "—",                   color: "gold"   },
    { label: "Tx. Conversão",   value: loading ? "…" : `${convRate.toFixed(2)}%`,                         color: "accent" },
    { label: "Alcance",         value: loading ? "…" : stats.reach.toLocaleString("pt-BR"),               color: "purple" },
  ];
}

const cplColor = (v: number) =>
  v > 0 && v <= 15 ? "text-accent" : v <= 30 ? "text-gold" : "text-red";

const regionColumns: Column<RegionRow>[] = [
  { key: "region",      label: "Região",
    render: v => <span className="text-text-primary text-xs">{String(v)}</span> },
  { key: "impressions", label: "Impressões", align: "right",
    render: v => <span className="text-text-secondary text-xs">{Number(v).toLocaleString("pt-BR")}</span> },
  { key: "clicks",      label: "Cliques",    align: "right",
    render: v => <span className="text-blue text-xs">{Number(v).toLocaleString("pt-BR")}</span> },
  { key: "ctr",         label: "CTR",        align: "right",
    render: v => <span className="text-accent text-xs">{Number(v).toFixed(2)}%</span> },
  { key: "spend",       label: "Investido",  align: "right",
    render: v => <span className="text-gold text-xs">R$ {Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span> },
];

// ─── Campaign ranking type ───────────────────────────────────────────────────
interface CampaignRank {
  campaign_name: string;
  platform: Platform;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  cpl: number;
}

const rankColumns: Column<CampaignRank>[] = [
  { key: "campaign_name", label: "Campanha",
    render: (v, row) => (
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${
          row.platform === "meta" ? "text-blue border-blue/30 bg-blue/10" : "text-gold border-gold/30 bg-gold/10"
        }`}>
          {row.platform === "meta" ? "Meta" : "Google"}
        </span>
        <span className="text-text-primary text-xs truncate max-w-[200px]" title={String(v)}>{String(v)}</span>
      </div>
    ) },
  { key: "spend",  label: "Investido", align: "right",
    render: v => <span className="text-blue text-xs font-mono">R$ {Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span> },
  { key: "leads",  label: "Leads", align: "right",
    render: v => <span className="text-accent text-xs font-mono font-semibold">{String(v)}</span> },
  { key: "cpl",    label: "CPL", align: "right",
    render: v => { const n = Number(v); return n > 0 ? <span className={`text-xs font-mono font-semibold ${cplColor(n)}`}>R$ {n.toFixed(2)}</span> : <span className="text-text-muted text-xs">—</span>; } },
];

// ─── Página ───────────────────────────────────────────────────────────────────
export default function OverviewPage() {
  const { client, setClient, platform, setPlatform, period, setPeriod, campaign, setCampaign, setMobileSidebarOpen } = useDashboard();

  const [clients,       setClients]       = useState<{ slug: string; name: string; display_name: string | null }[]>([]);
  const [campaignNames, setCampaignNames] = useState<string[]>([]);
  const [stats,         setStats]         = useState<LeadStats>({ leads: 0, spend: 0, impressions: 0, clicks: 0, reach: 0, landingPageViews: 0, leadFormSubmissions: 0 });
  const [sourceChart,   setSourceChart]   = useState<DonutSlice[]>([]);
  const [utmOrigins,    setUtmOrigins]    = useState<HorizontalBarItem[]>([]);
  const [formDonut,     setFormDonut]     = useState<DonutSlice[]>([]);
  const [trendData,     setTrendData]     = useState<TrendPoint[]>([]);
  const [regions,       setRegions]       = useState<RegionRow[]>([]);
  const [placements,    setPlacements]    = useState<HorizontalBarItem[]>([]);
  const [funnelSteps,   setFunnelSteps]   = useState<FunnelStep[]>([]);
  const [funnelMetrics, setFunnelMetrics] = useState<{ cpm: number; ctr: number; pageConvRate: number | null; checkoutConvRate: number | null; overallConvRate: number } | null>(null);
  const [campaignRank,  setCampaignRank]  = useState<CampaignRank[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [updatedAt,     setUpdatedAt]     = useState("");

  useEffect(() => {
    supabase.from("clients").select("slug, name, display_name").eq("active", true).order("name")
      .then(({ data }) => { if (data) setClients(data); });
  }, []);

  async function fetchData() {
    setLoading(true);
    const { since, until } = getPeriodDates(period);
    const { since: leadSince, until: leadUntil } = getLeadDates(period);
    const metaSlug = client === "all" ? null : client;

    // Leads no período (BRT) — só leads de campanha (com utm_medium)
    const leadsQ = supabase
      .from("leads")
      .select("id, lead_email, lead_name, conversion_event, utm_source, utm_medium, utm_campaign, utm_content, converted_at, source")
      .not("utm_medium", "is", null)
      .gte("converted_at", leadSince)
      .lte("converted_at", leadUntil);
    if (metaSlug) leadsQ.eq("client_slug", metaSlug);
    const { data: leadsData } = await leadsQ;
    // Filtra leads por plataforma: facebook/instagram = meta, google = google
    const allLeads = leadsData ?? [];
    const platformLeads = platform === "all" ? allLeads : allLeads.filter((l: any) => {
      const src = (l.utm_source ?? "").toLowerCase();
      if (platform === "meta") return src === "facebook" || src === "fb" || src === "instagram" || src === "ig";
      if (platform === "google") return src === "google";
      return true;
    });

    // Filtra leads pela campanha selecionada
    const leads = campaign === "all" ? platformLeads : platformLeads.filter((l: any) => {
      return l.utm_campaign && fuzzyMatch(l.utm_campaign, campaign);
    });

    // Campanhas (spend, impressions, clicks, reach)
    const adQ = supabase.from("ad_campaigns")
      .select("campaign_id, campaign_name, date, spend, impressions, clicks, reach, landing_page_views, lead_form_submissions, platform")
      .gte("date", since).lte("date", until);
    if (metaSlug) adQ.eq("client_slug", metaSlug);
    const { data: adData } = await adQ;
    const allAds = (adData ?? []).filter((a: any) => platform === "all" || a.platform === platform);

    // Extrair nomes de campanhas para o seletor
    const campNames = Array.from(new Set(allAds.map((a: any) => a.campaign_name).filter(Boolean))).sort();
    setCampaignNames(campNames);

    // Filtrar campanhas pela campanha selecionada
    const ads = campaign === "all" ? allAds : allAds.filter((a: any) => a.campaign_name === campaign);

    const totalSpend = ads.reduce((s: number, r: any) => s + Number(r.spend), 0);
    const totalImp   = ads.reduce((s: number, r: any) => s + Number(r.impressions), 0);
    const totalClk   = ads.reduce((s: number, r: any) => s + Number(r.clicks), 0);
    const totalReach = ads.reduce((s: number, r: any) => s + Number(r.reach), 0);
    const totalLpv   = ads.reduce((s: number, r: any) => s + Number(r.landing_page_views ?? 0), 0);
    const totalLfs   = ads.reduce((s: number, r: any) => s + Number(r.lead_form_submissions ?? 0), 0);

    // ── Funil: Impressões → Alcance → Cliques → Leads ──
    if (totalImp > 0 || leads.length > 0) {
      const fSteps: FunnelStep[] = [
        { label: "Impressões", value: totalImp },
        { label: "Alcance", value: totalReach, rate: totalImp > 0 ? (totalReach / totalImp) * 100 : 0 },
        { label: "Cliques", value: totalClk, rate: totalImp > 0 ? (totalClk / totalImp) * 100 : 0, sublabel: "CTR" },
        ...(totalLpv > 0 ? [{ label: "View Página", value: totalLpv, rate: totalClk > 0 ? (totalLpv / totalClk) * 100 : 0 }] : []),
        ...(totalLfs > 0 ? [{ label: "Formulário", value: totalLfs, rate: (totalLpv > 0 ? totalLpv : totalClk) > 0 ? (totalLfs / (totalLpv > 0 ? totalLpv : totalClk)) * 100 : 0 }] : []),
        { label: "Leads", value: leads.length, rate: (totalLfs > 0 ? totalLfs : totalLpv > 0 ? totalLpv : totalClk) > 0 ? (leads.length / (totalLfs > 0 ? totalLfs : totalLpv > 0 ? totalLpv : totalClk)) * 100 : 0 },
      ];
      setFunnelSteps(fSteps);
      setFunnelMetrics({
        cpm: totalImp > 0 ? (totalSpend / totalImp) * 1000 : 0,
        ctr: totalImp > 0 ? (totalClk / totalImp) * 100 : 0,
        pageConvRate: totalLpv > 0 ? (leads.length / totalLpv) * 100 : null,
        checkoutConvRate: totalLfs > 0 ? (leads.length / totalLfs) * 100 : null,
        overallConvRate: totalClk > 0 ? (leads.length / totalClk) * 100 : 0,
      });
    } else {
      setFunnelSteps([]);
      setFunnelMetrics(null);
    }

    // ── Campaign ranking (top 10 by leads) ──
    // Agrupa ads por campaign_name
    const campMap = new Map<string, { platform: Platform; impressions: number; clicks: number; spend: number }>();
    for (const r of allAds) {
      const key = r.campaign_name;
      const ex = campMap.get(key);
      if (ex) { ex.impressions += Number(r.impressions); ex.clicks += Number(r.clicks); ex.spend += Number(r.spend); }
      else campMap.set(key, { platform: r.platform as Platform, impressions: Number(r.impressions), clicks: Number(r.clicks), spend: Number(r.spend) });
    }
    // Atribui cada lead a no máximo UMA campanha (exato primeiro, fuzzy depois)
    const adCampNames = Array.from(campMap.keys());
    const leadsPerCamp = new Map<string, number>();
    for (const l of platformLeads) {
      if (!l.utm_campaign) continue;
      // 1. Match exato
      const exact = adCampNames.find(n => n === l.utm_campaign);
      if (exact) { leadsPerCamp.set(exact, (leadsPerCamp.get(exact) ?? 0) + 1); continue; }
      // 2. Substring (includes)
      const substr = adCampNames.find(n => n.includes(l.utm_campaign) || l.utm_campaign.includes(n));
      if (substr) { leadsPerCamp.set(substr, (leadsPerCamp.get(substr) ?? 0) + 1); continue; }
      // 3. Fuzzy (split por -)
      const fuzzy = adCampNames.find(n => fuzzyMatch(n, l.utm_campaign));
      if (fuzzy) { leadsPerCamp.set(fuzzy, (leadsPerCamp.get(fuzzy) ?? 0) + 1); }
    }
    const rankRows: CampaignRank[] = [];
    for (const [name, data] of Array.from(campMap.entries())) {
      const ld = leadsPerCamp.get(name) ?? 0;
      rankRows.push({ campaign_name: name, platform: data.platform, impressions: data.impressions, clicks: data.clicks, spend: data.spend, leads: ld, cpl: ld > 0 ? data.spend / ld : 0 });
    }
    setCampaignRank(rankRows.sort((a, b) => b.leads - a.leads).slice(0, 10));

    // IDs das campanhas selecionadas (para filtrar regiões e posicionamentos)
    const selectedCampIds = campaign === "all"
      ? null
      : new Set(ads.map((a: any) => a.campaign_id as string));

    // Regiões
    const regQ = supabase.from("ad_regions")
      .select("campaign_id, region, impressions, clicks, spend")
      .gte("date", since).lte("date", until);
    if (metaSlug) regQ.eq("client_slug", metaSlug);
    const { data: regData } = await regQ;
    const filteredRegData = selectedCampIds
      ? (regData ?? []).filter((r: any) => selectedCampIds.has(r.campaign_id))
      : (regData ?? []);
    const regMap = new Map<string, { impressions: number; clicks: number; spend: number }>();
    for (const r of filteredRegData) {
      const e = regMap.get(r.region) ?? { impressions: 0, clicks: 0, spend: 0 };
      e.impressions += Number(r.impressions);
      e.clicks      += Number(r.clicks);
      e.spend       += Number(r.spend);
      regMap.set(r.region, e);
    }
    const regionRows: RegionRow[] = Array.from(regMap.entries())
      .map(([region, v]) => ({ region, ...v, ctr: v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0 }))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10);

    // Posicionamentos
    const plcQ = supabase.from("ad_placements")
      .select("campaign_id, placement, impressions, clicks, spend, conversions")
      .gte("date", since).lte("date", until);
    if (metaSlug) plcQ.eq("client_slug", metaSlug);
    const { data: plcData } = await plcQ;
    const filteredPlcData = selectedCampIds
      ? (plcData ?? []).filter((r: any) => selectedCampIds.has(r.campaign_id))
      : (plcData ?? []);
    const plcMap = new Map<string, { impressions: number; clicks: number; spend: number; conversions: number }>();
    for (const r of filteredPlcData) {
      const e = plcMap.get(r.placement) ?? { impressions: 0, clicks: 0, spend: 0, conversions: 0 };
      e.impressions  += Number(r.impressions);
      e.clicks       += Number(r.clicks);
      e.spend        += Number(r.spend);
      e.conversions  += Number(r.conversions ?? 0);
      plcMap.set(r.placement, e);
    }
    const totalPlcConv = Array.from(plcMap.values()).reduce((s, v) => s + v.conversions, 0);
    const placementBars: HorizontalBarItem[] = Array.from(plcMap.entries())
      .filter(([, v]) => v.conversions > 0 || v.impressions > 0)
      .map(([label, v], i) => ({
        label: formatPlacement(label),
        value: v.conversions,
        rate: totalPlcConv > 0 ? (v.conversions / totalPlcConv) * 100 : 0,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Trend: leads x investimento x CPL por dia (BRT)
    const leadsByDay = new Map<string, number>();
    for (const l of leads) {
      const day = toBRTDate(String(l.converted_at));
      leadsByDay.set(day, (leadsByDay.get(day) ?? 0) + 1);
    }
    const spendByDay = new Map<string, number>();
    for (const a of ads) {
      spendByDay.set(a.date, (spendByDay.get(a.date) ?? 0) + Number(a.spend));
    }
    const allDays = Array.from(new Set([...Array.from(leadsByDay.keys()), ...Array.from(spendByDay.keys())])).sort();
    const trend: TrendPoint[] = allDays.map(day => {
      const ld = leadsByDay.get(day) ?? 0;
      const sp = spendByDay.get(day) ?? 0;
      return { date: day.slice(5), leads: ld, spend: sp, cpl: ld > 0 ? sp / ld : 0 };
    });

    // Donut: leads por fonte (RD Station vs Meta Lead Form)
    const srcCounts: Record<string, number> = {};
    for (const l of leads) {
      const key = l.source ?? "rdstation";
      srcCounts[key] = (srcCounts[key] ?? 0) + 1;
    }
    const srcLabels: Record<string, string> = { rdstation: "RD Station", meta_leadform: "Meta Lead Form", manual: "Manual" };
    const srcColors: Record<string, string> = { rdstation: "#CAFF04", meta_leadform: "#60A5FA", manual: "#F59E0B" };
    const srcDonut = Object.entries(srcCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => ({ label: srcLabels[key] ?? key, value, color: srcColors[key] ?? "#A78BFA" }));

    // Donut: leads por formulário
    const formCounts: Record<string, number> = {};
    for (const l of leads) {
      const key = l.conversion_event ?? "desconhecido";
      formCounts[key] = (formCounts[key] ?? 0) + 1;
    }
    const fDonut = Object.entries(formCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value], i) => ({ label, value, color: CHART_COLORS[i % CHART_COLORS.length] }));

    // Bar: leads por UTM source (origem do tráfego)
    const utmCounts: Record<string, number> = {};
    for (const l of leads) {
      const key = l.utm_source || "Direto";
      utmCounts[key] = (utmCounts[key] ?? 0) + 1;
    }
    const totalLeads = leads.length;
    const utmBars = Object.entries(utmCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value], i) => ({
        label,
        value,
        rate: totalLeads > 0 ? (value / totalLeads) * 100 : 0,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }));

    setStats({ leads: leads.length, spend: totalSpend, impressions: totalImp, clicks: totalClk, reach: totalReach, landingPageViews: totalLpv, leadFormSubmissions: totalLfs });
    setSourceChart(srcDonut);
    setFormDonut(fDonut);
    setUtmOrigins(utmBars);
    setTrendData(trend);
    setRegions(regionRows);
    setPlacements(placementBars);
    setUpdatedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [client, period, platform, campaign]);

  const kpis = buildKPIs(stats, loading);

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-h-0 overflow-y-auto">

        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur-sm border-b border-border px-4 md:px-6 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden flex-shrink-0 w-8 h-8 rounded-lg border border-border bg-card flex items-center justify-center text-text-secondary hover:text-accent transition-colors"
            >
              <Menu size={16} />
            </button>

            {clients.length > 0 && (
              <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5 flex-1 md:flex-none">
                <Building2 size={13} className="text-text-muted flex-shrink-0" />
                <select
                  value={client}
                  onChange={e => setClient(e.target.value)}
                  className="bg-transparent text-xs text-text-primary focus:outline-none cursor-pointer w-full md:max-w-[160px]"
                >
                  <option value="all">Todas as contas</option>
                  {clients.map(c => (
                    <option key={c.slug} value={c.slug}>{c.display_name ?? c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Campaign selector */}
            {campaignNames.length > 0 && (
              <div className="hidden sm:flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5">
                <Megaphone size={13} className="text-text-muted flex-shrink-0" />
                <select
                  value={campaign}
                  onChange={e => setCampaign(e.target.value)}
                  className="bg-transparent text-xs text-text-primary focus:outline-none cursor-pointer max-w-[180px] truncate"
                >
                  <option value="all">Todas as campanhas</option>
                  {campaignNames.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="hidden sm:flex items-center bg-card border border-border rounded-lg overflow-hidden text-xs font-medium">
              {(["all", "meta", "google"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPlatform(p as Platform | "all")}
                  className={`px-3 py-1.5 transition-colors ${
                    platform === p ? "bg-accent/10 text-accent" : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {p === "all" ? "Todos" : p === "meta" ? "Meta" : "Google"}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5 ml-auto">
              <Calendar size={13} className="text-text-muted flex-shrink-0" />
              <select
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className="bg-transparent text-xs text-text-primary focus:outline-none cursor-pointer"
              >
                {periods.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={fetchData}
              className="flex-shrink-0 flex items-center gap-1.5 bg-accent text-bg text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-accent/90 transition-colors"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>

          {/* Mobile: platform toggle + campaign selector */}
          <div className="flex items-center justify-between mt-2 sm:mt-0 sm:hidden gap-2">
            <div className="flex items-center bg-card border border-border rounded-lg overflow-hidden text-xs font-medium">
              {(["all", "meta", "google"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPlatform(p as Platform | "all")}
                  className={`px-3 py-1.5 transition-colors ${
                    platform === p ? "bg-accent/10 text-accent" : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {p === "all" ? "Todos" : p === "meta" ? "Meta" : "Google"}
                </button>
              ))}
            </div>
            {updatedAt && <span className="text-[10px] text-text-muted font-mono">{updatedAt}</span>}
          </div>
          {/* Mobile campaign selector */}
          {campaignNames.length > 0 && (
            <div className="sm:hidden mt-2">
              <select
                value={campaign}
                onChange={e => setCampaign(e.target.value)}
                className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none cursor-pointer"
              >
                <option value="all">Todas as campanhas</option>
                {campaignNames.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
          {updatedAt && (
            <div className="hidden sm:block mt-0.5 text-[10px] text-text-muted text-right">
              Atualizado: <span className="font-mono">{updatedAt}</span>
            </div>
          )}
        </div>

        <div className="p-4 md:p-6 space-y-5">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {kpis.slice(0, 5).map(kpi => <KPICard key={kpi.label} {...kpi} />)}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {kpis.slice(5).map(kpi => <KPICard key={kpi.label} {...kpi} />)}
          </div>

          {/* Funil + Gráfico de tendência */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {funnelSteps.length > 0 && (
              <div className="lg:col-span-1">
                <Funnel steps={funnelSteps} metrics={funnelMetrics} />
              </div>
            )}
            <div className={funnelSteps.length > 0 ? "lg:col-span-2" : "lg:col-span-3"}>
              {trendData.length > 0 && <DualAxisChart data={trendData} showCpl />}
            </div>
          </div>

          {/* Ranking de campanhas */}
          {campaignRank.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Trophy size={14} className="text-gold" />
                <span className="text-sm font-semibold text-text-primary">Ranking de Campanhas</span>
                <span className="text-xs text-text-muted ml-auto">{campaignRank.length} campanhas · ordenado por leads</span>
              </div>
              <DataTable<CampaignRank> columns={rankColumns} data={campaignRank} rowKey="campaign_name" />
            </div>
          )}

          {/* Gráficos médios */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <DonutChart title="Leads por Fonte"       data={sourceChart} centerLabel="total" />
            <HorizontalBar title="Leads por Origem"   data={utmOrigins}  valueLabel="leads por UTM source" />
            <DonutChart title="Leads por Formulário"   data={formDonut}   centerLabel="leads" />
          </div>

          {/* Posicionamento + Regiões */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {placements.length > 0 && (
              <HorizontalBar title="Conversões por Posicionamento" data={placements} valueLabel="conversões por placement" />
            )}
            {regions.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <span className="text-sm font-semibold text-text-primary block mb-3">Top Regiões por Impressões</span>
                <DataTable<RegionRow> columns={regionColumns} data={regions} rowKey="region" />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
