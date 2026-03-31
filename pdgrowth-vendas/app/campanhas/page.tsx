"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import DataTable, { Column } from "@/components/data-table";
import { useDashboard } from "@/lib/dashboard-context";
import { mockCampaigns, mockAdSets, mockCreatives } from "@/lib/mock-data";
import type { CampaignRow, AdSetRow, CreativeRow, Platform } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

type Tab = "campanhas" | "conjuntos" | "anuncios";

function getPeriodDates(period: string) {
  const days = period === "last7" ? 7 : period === "last90" ? 90 : 30;
  const until = new Date();
  until.setDate(until.getDate() - 1);
  const since = new Date(until);
  since.setDate(since.getDate() - days + 1);
  return {
    since: since.toISOString().split("T")[0],
    until: until.toISOString().split("T")[0],
  };
}

const PlatformBadge = ({ p }: { p: Platform }) => (
  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${
    p === "meta" ? "text-blue border-blue/30 bg-blue/10" : "text-gold border-gold/30 bg-gold/10"
  }`}>
    {p === "meta" ? "Meta" : "Google"}
  </span>
);

const roasColor = (v: number) =>
  v >= 4.5 ? "text-accent" : v >= 3 ? "text-gold" : "text-red";

const campaignColumns: Column<CampaignRow>[] = [
  {
    key: "campaign_name",
    label: "Campanha",
    render: (v, row) => (
      <div className="flex items-center gap-2">
        <PlatformBadge p={row.platform} />
        <span className="text-text-primary text-sm truncate max-w-xs" title={String(v)}>{String(v)}</span>
      </div>
    ),
  },
  { key: "impressions", label: "Impressões", align: "right",
    render: v => Number(v).toLocaleString("pt-BR") },
  { key: "clicks",      label: "Cliques",    align: "right",
    render: v => Number(v).toLocaleString("pt-BR") },
  { key: "ctr",         label: "CTR",        align: "right",
    render: v => <span className="text-text-secondary">{Number(v).toFixed(1)}%</span> },
  { key: "spend",       label: "Investido",  align: "right",
    render: v => <span className="text-blue">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "revenue",     label: "Receita",    align: "right",
    render: v => <span className="text-accent">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "sales",       label: "Vendas",     align: "right",
    render: v => <span className="text-green font-semibold">{String(v)}</span> },
  { key: "roas",        label: "ROAS",       align: "right",
    render: v => <span className={`font-semibold ${roasColor(Number(v))}`}>{Number(v).toFixed(2)}×</span> },
  { key: "cpa",         label: "CPA",        align: "right",
    render: v => <span className="text-gold">R$ {Number(v).toFixed(2)}</span> },
];

const adSetColumns: Column<AdSetRow>[] = [
  {
    key: "ad_set_name",
    label: "Conjunto",
    render: (v, row) => (
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <PlatformBadge p={row.platform} />
          <span className="text-text-primary text-sm">{String(v)}</span>
        </div>
        <span className="text-xs text-text-muted">{row.campaign_name}</span>
      </div>
    ),
  },
  { key: "impressions", label: "Impressões", align: "right",
    render: v => Number(v).toLocaleString("pt-BR") },
  { key: "clicks",      label: "Cliques",    align: "right",
    render: v => Number(v).toLocaleString("pt-BR") },
  { key: "ctr",         label: "CTR",        align: "right",
    render: v => <span className="text-text-secondary">{Number(v).toFixed(1)}%</span> },
  { key: "spend",       label: "Investido",  align: "right",
    render: v => <span className="text-blue">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "revenue",     label: "Receita",    align: "right",
    render: v => <span className="text-accent">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "sales",       label: "Vendas",     align: "right",
    render: v => <span className="text-green font-semibold">{String(v)}</span> },
  { key: "roas",        label: "ROAS",       align: "right",
    render: v => <span className={`font-semibold ${roasColor(Number(v))}`}>{Number(v).toFixed(2)}×</span> },
  { key: "cpa",         label: "CPA",        align: "right",
    render: v => <span className="text-gold">R$ {Number(v).toFixed(2)}</span> },
];

const adColumns: Column<CreativeRow>[] = [
  {
    key: "ad_name",
    label: "Anúncio",
    render: (v, row) => (
      <div className="flex items-center gap-3">
        <div className="relative w-14 h-9 rounded-md overflow-hidden bg-bg flex-shrink-0 border border-border">
          {row.thumbnail_url
            ? <Image src={row.thumbnail_url} alt={String(v)} fill className="object-cover" sizes="56px" unoptimized />
            : <div className="w-full h-full flex items-center justify-center text-text-muted text-[10px]">—</div>
          }
        </div>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <PlatformBadge p={row.platform} />
            <span className="text-text-primary text-sm">{String(v)}</span>
          </div>
          <span className="text-xs text-text-muted">{row.campaign_name}</span>
        </div>
      </div>
    ),
  },
  { key: "impressions", label: "Impressões", align: "right",
    render: v => Number(v).toLocaleString("pt-BR") },
  { key: "clicks",      label: "Cliques",    align: "right",
    render: v => Number(v).toLocaleString("pt-BR") },
  { key: "ctr",         label: "CTR",        align: "right",
    render: v => <span className="text-text-secondary">{Number(v).toFixed(1)}%</span> },
  { key: "spend",       label: "Investido",  align: "right",
    render: v => <span className="text-blue">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "revenue",     label: "Receita",    align: "right",
    render: v => <span className="text-accent">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "sales",       label: "Vendas",     align: "right",
    render: v => <span className="text-green font-semibold">{String(v)}</span> },
  { key: "roas",        label: "ROAS",       align: "right",
    render: v => <span className={`font-semibold ${roasColor(Number(v))}`}>{Number(v).toFixed(2)}×</span> },
  { key: "cpa",         label: "CPA",        align: "right",
    render: v => <span className="text-gold">R$ {Number(v).toFixed(2)}</span> },
];

export default function CampanhasPage() {
  const { platform, period } = useDashboard();
  const [tab, setTab]       = useState<Tab>("campanhas");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [campaigns, setCampaigns] = useState<CampaignRow[]>(mockCampaigns);
  const [adSets,    setAdSets]    = useState<AdSetRow[]>(mockAdSets);
  const [ads,       setAds]       = useState<CreativeRow[]>(mockCreatives);
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    const { since, until } = getPeriodDates(period);
    setLoading(true);

    const baseCamp = supabase.from("ad_campaigns").select("campaign_id,campaign_name,platform,impressions,clicks,spend").gte("date", since).lte("date", until);
    const baseSets = supabase.from("ad_sets").select("ad_set_id,ad_set_name,campaign_name,platform,impressions,clicks,spend").gte("date", since).lte("date", until);
    const baseAds  = supabase.from("ad_creatives").select("ad_id,ad_name,campaign_name,platform,creative_type,thumbnail_url,video_url,permalink_url,headline,impressions,clicks,spend,frequency").gte("date", since).lte("date", until);

    const qCamp = platform !== "all" ? baseCamp.eq("platform", platform) : baseCamp;
    const qSets = platform !== "all" ? baseSets.eq("platform", platform) : baseSets;
    const qAds  = platform !== "all" ? baseAds.eq("platform", platform)  : baseAds;

    Promise.all([qCamp, qSets, qAds]).then(([campRes, setsRes, adsRes]) => {
      setLoading(false);

      if (campRes.data && campRes.data.length > 0) {
        const map = new Map<string, CampaignRow>();
        for (const r of campRes.data) {
          const key = `${r.platform}:${r.campaign_id}`;
          const ex  = map.get(key);
          if (ex) {
            ex.impressions += r.impressions ?? 0;
            ex.clicks      += r.clicks ?? 0;
            ex.spend       += r.spend ?? 0;
          } else {
            map.set(key, { campaign_id: r.campaign_id, campaign_name: r.campaign_name, platform: r.platform as Platform,
              impressions: r.impressions ?? 0, clicks: r.clicks ?? 0, spend: r.spend ?? 0,
              revenue: 0, sales: 0, roas: 0, cpa: 0, ctr: 0 });
          }
        }
        setCampaigns(Array.from(map.values()).map(c => ({ ...c, ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0 })));
      } else {
        setCampaigns(mockCampaigns);
      }

      if (setsRes.data && setsRes.data.length > 0) {
        const map = new Map<string, AdSetRow>();
        for (const r of setsRes.data) {
          const key = `${r.platform}:${r.ad_set_id}`;
          const ex  = map.get(key);
          if (ex) {
            ex.impressions += r.impressions ?? 0;
            ex.clicks      += r.clicks ?? 0;
            ex.spend       += r.spend ?? 0;
          } else {
            map.set(key, { ad_set_id: r.ad_set_id, ad_set_name: r.ad_set_name, campaign_name: r.campaign_name ?? "", platform: r.platform as Platform,
              impressions: r.impressions ?? 0, clicks: r.clicks ?? 0, spend: r.spend ?? 0,
              revenue: 0, sales: 0, roas: 0, cpa: 0, ctr: 0 });
          }
        }
        setAdSets(Array.from(map.values()).map(c => ({ ...c, ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0 })));
      } else {
        setAdSets(mockAdSets);
      }

      if (adsRes.data && adsRes.data.length > 0) {
        const map = new Map<string, CreativeRow>();
        for (const r of adsRes.data) {
          const key = `${r.platform}:${r.ad_id}`;
          const ex  = map.get(key);
          if (ex) {
            ex.impressions += r.impressions ?? 0;
            ex.clicks      += r.clicks ?? 0;
            ex.spend       += r.spend ?? 0;
          } else {
            map.set(key, { ad_id: r.ad_id, ad_name: r.ad_name, campaign_name: r.campaign_name ?? "", platform: r.platform as Platform,
              creative_type: r.creative_type ?? null, thumbnail_url: r.thumbnail_url ?? null,
              video_url: r.video_url ?? null, permalink_url: r.permalink_url ?? null, headline: r.headline ?? null,
              impressions: r.impressions ?? 0, clicks: r.clicks ?? 0, spend: r.spend ?? 0,
              frequency: r.frequency ?? null,
              revenue: 0, sales: 0, roas: 0, cpa: 0, ctr: 0, cpm: 0, conv_rate: 0,
              video_3s_rate: null, video_thruplay_rate: null });
          }
        }
        setAds(Array.from(map.values()).map(c => ({
          ...c,
          ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
          cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0,
        })));
      } else {
        setAds(mockCreatives);
      }
    });
  }, [platform, period]);

  const byPlatform = <T extends { platform: Platform }>(arr: T[]) =>
    platform === "all" ? arr : arr.filter(c => c.platform === platform);

  const filteredCampaigns = campaigns;
  const filteredAdSets    = selectedCampaign === "all" ? adSets : adSets.filter(c => c.campaign_name === selectedCampaign);
  const filteredAds       = selectedCampaign === "all" ? ads    : ads.filter(c => c.campaign_name === selectedCampaign);

  const activeData =
    tab === "campanhas" ? filteredCampaigns :
    tab === "conjuntos" ? filteredAdSets :
    filteredAds;

  const campaignOptions = ["all", ...Array.from(new Set(byPlatform(campaigns).map(c => c.campaign_name)))];

  const totalSpend   = activeData.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = activeData.reduce((s, c) => s + c.revenue, 0);
  const totalSales   = activeData.reduce((s, c) => s + c.sales, 0);
  const overallRoas  = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  const tabs: { id: Tab; label: string }[] = [
    { id: "campanhas", label: "Campanhas" },
    { id: "conjuntos", label: "Conjuntos" },
    { id: "anuncios",  label: "Anúncios"  },
  ];

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <Header title="Campanhas" subtitle="Performance por campanha, conjunto e anúncio" />

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl px-2 py-1.5">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === t.id
                    ? "bg-accent/10 text-accent border border-accent/20"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab !== "campanhas" && (
            <select
              value={selectedCampaign}
              onChange={e => setSelectedCampaign(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent/40 cursor-pointer font-mono"
            >
              <option value="all">Todas as campanhas</option>
              {campaignOptions.filter(c => c !== "all").map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex gap-4 mb-5 p-3 bg-card border border-border rounded-xl text-sm">
          <Stat label="Invest. Total"  value={`R$ ${totalSpend.toLocaleString("pt-BR")}`}   color="text-blue"   />
          <div className="w-px bg-border" />
          <Stat label="Receita Total"  value={`R$ ${totalRevenue.toLocaleString("pt-BR")}`}  color="text-accent" />
          <div className="w-px bg-border" />
          <Stat label="Vendas"         value={String(totalSales)}                            color="text-green"  />
          <div className="w-px bg-border" />
          <Stat label="ROAS Geral"     value={`${overallRoas.toFixed(2)}×`}                  color={roasColor(overallRoas)} />
        </div>

        {loading ? (
          <div className="text-text-secondary text-sm py-8 text-center">Carregando...</div>
        ) : (
          <>
            {tab === "campanhas" && (
              <DataTable<CampaignRow> columns={campaignColumns} data={filteredCampaigns} rowKey="campaign_id" />
            )}
            {tab === "conjuntos" && (
              <DataTable<AdSetRow> columns={adSetColumns} data={filteredAdSets} rowKey="ad_set_id" />
            )}
            {tab === "anuncios" && (
              <DataTable<CreativeRow> columns={adColumns} data={filteredAds} rowKey="ad_id" />
            )}
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
