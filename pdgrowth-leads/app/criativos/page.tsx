"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/sidebar";
import CreativeCard from "@/components/creative-card";
import DataTable, { Column } from "@/components/data-table";
import { useDashboard } from "@/lib/dashboard-context";
import { mockCreatives } from "@/lib/mock-data";
import type { CreativeRow, Platform } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { getPeriodDates, getSalesDates } from "@/lib/period";
import { LayoutGrid, List, ArrowUpDown } from "lucide-react";
import Image from "next/image";

type SortKey = "roas" | "ctr" | "cpa" | "spend" | "sales" | "cpm" | "conv_rate";

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "roas",      label: "ROAS"           },
  { value: "ctr",       label: "CTR"            },
  { value: "conv_rate", label: "Conv. Rate"     },
  { value: "cpa",       label: "CPA (menor)"    },
  { value: "spend",     label: "Investimento"   },
  { value: "sales",     label: "Vendas"         },
  { value: "cpm",       label: "CPM (menor)"    },
];

const roasColor = (v: number) =>
  v >= 4.5 ? "text-accent" : v >= 3 ? "text-gold" : "text-red";

const PlatformBadge = ({ p }: { p: Platform }) => (
  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${
    p === "meta" ? "text-blue border-blue/30 bg-blue/10" : "text-gold border-gold/30 bg-gold/10"
  }`}>
    {p === "meta" ? "Meta" : "Google"}
  </span>
);

const tableColumns: Column<CreativeRow>[] = [
  {
    key: "ad_name",
    label: "Criativo",
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
  { key: "cpm",         label: "CPM",        align: "right",
    render: v => <span className="text-text-secondary">R$ {Number(v).toFixed(2)}</span> },
  { key: "spend",       label: "Investido",  align: "right",
    render: v => <span className="text-blue">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "revenue",     label: "Receita",    align: "right",
    render: v => <span className="text-accent">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "roas",        label: "ROAS",       align: "right",
    render: v => <span className={`font-semibold ${roasColor(Number(v))}`}>{Number(v).toFixed(2)}×</span> },
  { key: "cpa",         label: "CPA",        align: "right",
    render: v => <span className="text-gold">R$ {Number(v).toFixed(2)}</span> },
];

export default function CriativosPage() {
  const { platform, period, client } = useDashboard();
  const [view,     setView]     = useState<"grid" | "list">("grid");
  const [campaign, setCampaign] = useState<string>("all");
  const [sortBy,   setSortBy]   = useState<SortKey>("roas");
  const [data,     setData]     = useState<CreativeRow[]>(mockCreatives);
  const [loading,  setLoading]  = useState(false);

  const [clients, setClients] = useState<{ slug: string; sales_slug: string | null }[]>([]);

  useEffect(() => {
    supabase.from("clients").select("slug, sales_slug").eq("active", true)
      .then(({ data }) => { if (data) setClients(data); });
  }, []);

  useEffect(() => {
    const { since, until } = getPeriodDates(period);
    const { since: salesSince, until: salesUntil } = getSalesDates(period);
    setLoading(true);

    const metaSlug  = client !== "all" ? client : null;
    const found     = clients.find(c => c.slug === client);
    const salesSlug = client !== "all" ? (found?.sales_slug ?? client) : null;

    const base = supabase.from("ad_creatives")
      .select("ad_id,ad_name,campaign_name,platform,creative_type,thumbnail_url,video_url,permalink_url,headline,impressions,clicks,spend,frequency")
      .gte("date", since).lte("date", until);

    const q1    = platform !== "all" ? base.eq("platform", platform) : base;
    const qAds  = metaSlug ? q1.eq("client_slug", metaSlug) : q1;

    // Vendas por utm_content (nome do criativo) — janela BRT
    const baseSales = supabase.from("sales")
      .select("amount, amount_net, sale_type, utm_content")
      .eq("status", "approved")
      .gte("created_at", salesSince)
      .lte("created_at", salesUntil);
    const qSales = salesSlug ? baseSales.eq("client_slug", salesSlug) : baseSales;

    Promise.all([qAds, qSales]).then(([{ data: rows, error }, { data: salesData }]) => {
      setLoading(false);

      const mainSales = (salesData ?? []).filter((s: any) => s.sale_type === "main");
      const byAdName  = new Map<string, { sales: number; revenue: number }>();
      for (const s of mainSales) {
        if (!s.utm_content) continue;
        const e = byAdName.get(s.utm_content) ?? { sales: 0, revenue: 0 };
        e.sales++;
        e.revenue += Number(s.amount_net ?? s.amount);
        byAdName.set(s.utm_content, e);
      }

      if (!error && rows && rows.length > 0) {
        const map = new Map<string, CreativeRow>();
        for (const r of rows) {
          const key = `${r.platform}:${r.ad_id}`;
          const ex  = map.get(key);
          if (ex) {
            ex.impressions += r.impressions ?? 0;
            ex.clicks      += r.clicks ?? 0;
            ex.spend       += r.spend ?? 0;
          } else {
            map.set(key, {
              ad_id: r.ad_id, ad_name: r.ad_name, campaign_name: r.campaign_name ?? "",
              platform: r.platform as Platform, creative_type: r.creative_type ?? null,
              thumbnail_url: r.thumbnail_url ?? null, video_url: r.video_url ?? null,
              permalink_url: r.permalink_url ?? null, headline: r.headline ?? null,
              impressions: r.impressions ?? 0, clicks: r.clicks ?? 0, spend: r.spend ?? 0,
              frequency: r.frequency ?? null,
              revenue: 0, sales: 0, roas: 0, cpa: 0, ctr: 0, cpm: 0, conv_rate: 0,
              video_3s_rate: null, video_thruplay_rate: null,
            });
          }
        }
        setData(Array.from(map.values()).map(c => {
          const sv = byAdName.get(c.ad_name) ?? { sales: 0, revenue: 0 };
          return {
            ...c,
            ctr:     c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
            cpm:     c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0,
            sales:   sv.sales,
            revenue: sv.revenue,
            roas:    c.spend > 0 ? sv.revenue / c.spend : 0,
            cpa:     sv.sales > 0 ? c.spend / sv.sales : 0,
          };
        }));
      } else {
        setData(mockCreatives);
      }
    });
  }, [platform, period, client, clients]);

  const campaigns = ["all", ...Array.from(new Set(data.map(c => c.campaign_name).filter(Boolean)))];

  const filtered = (campaign === "all" ? data : data.filter(c => c.campaign_name === campaign))
    .slice()
    .sort((a, b) => {
      if (sortBy === "cpa" || sortBy === "cpm") return (a[sortBy] ?? 0) - (b[sortBy] ?? 0);
      return (b[sortBy] ?? 0) - (a[sortBy] ?? 0);
    });

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-h-0 p-4 md:p-6 overflow-y-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Criativos</h1>
            <p className="text-sm text-text-secondary mt-0.5">Performance por anúncio com prévia do criativo</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={campaign}
              onChange={e => setCampaign(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40 cursor-pointer max-w-[200px] truncate"
            >
              {campaigns.map(c => (
                <option key={c} value={c}>{c === "all" ? "Todas as campanhas" : c}</option>
              ))}
            </select>
            <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-2.5 py-2">
              <ArrowUpDown size={12} className="text-text-muted flex-shrink-0" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortKey)}
                className="bg-transparent text-xs text-text-primary focus:outline-none cursor-pointer"
              >
                {sortOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center bg-card border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setView("grid")}
                className={`px-3 py-2 transition-colors ${view === "grid" ? "bg-border text-text-primary" : "text-text-muted hover:text-text-secondary"}`}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setView("list")}
                className={`px-3 py-2 transition-colors ${view === "list" ? "bg-border text-text-primary" : "text-text-muted hover:text-text-secondary"}`}
              >
                <List size={14} />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-text-secondary text-sm py-8 text-center">Carregando...</div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(c => <CreativeCard key={c.ad_id} creative={c} />)}
          </div>
        ) : (
          <DataTable<CreativeRow> columns={tableColumns} data={filtered} rowKey="ad_id" />
        )}
      </main>
    </div>
  );
}
