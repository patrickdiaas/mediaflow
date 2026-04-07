"use client";
import { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";
import KPICard from "@/components/kpi-card";
import DualAxisChart from "@/components/dual-axis-chart";
import DonutChart from "@/components/donut-chart";
import HorizontalBar from "@/components/horizontal-bar";
import DataTable, { Column } from "@/components/data-table";
import { useDashboard } from "@/lib/dashboard-context";
import { supabase } from "@/lib/supabase";
import { getPeriodDates, getLeadDates } from "@/lib/period";
import type { Platform, KPIData, DonutSlice, HorizontalBarItem, TrendPoint, RegionRow } from "@/lib/types";
import { RefreshCw, Calendar, Building2, Menu } from "lucide-react";

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

// ─── Página ───────────────────────────────────────────────────────────────────
export default function OverviewPage() {
  const { client, setClient, platform, setPlatform, period, setPeriod, setMobileSidebarOpen } = useDashboard();

  const [clients,       setClients]       = useState<{ slug: string; name: string; display_name: string | null }[]>([]);
  const [stats,         setStats]         = useState<LeadStats>({ leads: 0, spend: 0, impressions: 0, clicks: 0, reach: 0, landingPageViews: 0, leadFormSubmissions: 0 });
  const [sourceChart,   setSourceChart]   = useState<DonutSlice[]>([]);
  const [utmOrigins,    setUtmOrigins]    = useState<HorizontalBarItem[]>([]);
  const [formDonut,     setFormDonut]     = useState<DonutSlice[]>([]);
  const [trendData,     setTrendData]     = useState<TrendPoint[]>([]);
  const [regions,       setRegions]       = useState<RegionRow[]>([]);
  const [placements,    setPlacements]    = useState<HorizontalBarItem[]>([]);
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
    const leads = platform === "all" ? allLeads : allLeads.filter((l: any) => {
      const src = (l.utm_source ?? "").toLowerCase();
      if (platform === "meta") return src === "facebook" || src === "fb" || src === "instagram" || src === "ig";
      if (platform === "google") return src === "google";
      return true;
    });

    // Campanhas (spend, impressions, clicks, reach)
    const adQ = supabase.from("ad_campaigns")
      .select("date, spend, impressions, clicks, reach, landing_page_views, lead_form_submissions, platform")
      .gte("date", since).lte("date", until);
    if (metaSlug) adQ.eq("client_slug", metaSlug);
    const { data: adData } = await adQ;
    const ads = (adData ?? []).filter((a: any) => platform === "all" || a.platform === platform);

    const totalSpend = ads.reduce((s: number, r: any) => s + Number(r.spend), 0);
    const totalImp   = ads.reduce((s: number, r: any) => s + Number(r.impressions), 0);
    const totalClk   = ads.reduce((s: number, r: any) => s + Number(r.clicks), 0);
    const totalReach = ads.reduce((s: number, r: any) => s + Number(r.reach), 0);
    const totalLpv   = ads.reduce((s: number, r: any) => s + Number(r.landing_page_views ?? 0), 0);
    const totalLfs   = ads.reduce((s: number, r: any) => s + Number(r.lead_form_submissions ?? 0), 0);

    // Regiões
    const regQ = supabase.from("ad_regions")
      .select("region, impressions, clicks, spend")
      .gte("date", since).lte("date", until);
    if (metaSlug) regQ.eq("client_slug", metaSlug);
    const { data: regData } = await regQ;
    const regMap = new Map<string, { impressions: number; clicks: number; spend: number }>();
    for (const r of (regData ?? [])) {
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
      .select("placement, impressions, clicks, spend, conversions")
      .gte("date", since).lte("date", until);
    if (metaSlug) plcQ.eq("client_slug", metaSlug);
    const { data: plcData } = await plcQ;
    const plcMap = new Map<string, { impressions: number; clicks: number; spend: number; conversions: number }>();
    for (const r of (plcData ?? [])) {
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

    // Trend: leads x investimento por dia
    const leadsByDay = new Map<string, number>();
    for (const l of leads) {
      const day = String(l.converted_at).slice(0, 10);
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

  useEffect(() => { fetchData(); }, [client, period, platform]);

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

          <div className="flex items-center justify-between mt-2 sm:mt-0 sm:hidden">
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

          {/* Gráfico de tendência */}
          {trendData.length > 0 && <DualAxisChart data={trendData} />}

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
