"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/sidebar";
import CreativeCard from "@/components/creative-card";
import DataTable, { Column } from "@/components/data-table";

function extractWords(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(w => w.length > 1);
}
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
import type { CreativeRow, Platform } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { getPeriodDates, getLeadDates } from "@/lib/period";
import { LayoutGrid, List, ArrowUpDown } from "lucide-react";
import Image from "next/image";

type SortKey = "cpl" | "ctr" | "spend" | "leads" | "cpm";

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "cpl",   label: "CPL (menor)"   },
  { value: "ctr",   label: "CTR"           },
  { value: "spend", label: "Investimento"  },
  { value: "leads", label: "Leads"         },
  { value: "cpm",   label: "CPM (menor)"   },
];

const cplColor = (v: number) =>
  v > 0 && v <= 15 ? "text-accent" : v <= 30 ? "text-gold" : "text-red";

const PlatformBadge = ({ p }: { p: Platform }) => (
  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${
    p === "meta" ? "text-blue border-blue/30 bg-blue/10" : "text-gold border-gold/30 bg-gold/10"
  }`}>
    {p === "meta" ? "Meta" : "Google"}
  </span>
);

const tableColumns: Column<CreativeRow>[] = [
  {
    key: "ad_name", label: "Criativo",
    render: (v, row) => (
      <div className="flex items-center gap-3">
        <div className="relative w-14 h-9 rounded-md overflow-hidden bg-bg flex-shrink-0 border border-border">
          {row.thumbnail_url
            ? <Image src={row.thumbnail_url} alt={String(v)} fill className="object-cover" sizes="56px" unoptimized />
            : row.platform === "google"
              ? <div className="w-full h-full flex items-center justify-center text-gold text-[10px] font-bold">Search</div>
              : <div className="w-full h-full flex items-center justify-center text-text-muted text-[10px]">—</div>}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-0.5"><PlatformBadge p={row.platform} /><span className="text-text-primary text-sm">{String(v)}</span></div>
          {row.headline && <span className="text-xs text-gold block mb-0.5">{row.headline}</span>}
          <span className="text-xs text-text-muted">{row.campaign_name}{row.placement ? ` · ${row.placement}` : ""}</span>
        </div>
      </div>
    ),
  },
  { key: "impressions", label: "Impressões", align: "right", render: v => Number(v).toLocaleString("pt-BR") },
  { key: "clicks",      label: "Cliques",    align: "right", render: v => Number(v).toLocaleString("pt-BR") },
  { key: "ctr",         label: "CTR",        align: "right", render: v => <span className="text-text-secondary">{Number(v).toFixed(1)}%</span> },
  { key: "cpm",         label: "CPM",        align: "right", render: v => <span className="text-text-secondary">R$ {Number(v).toFixed(2)}</span> },
  { key: "spend",       label: "Investido",  align: "right", render: v => <span className="text-blue">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "leads",       label: "Leads",      align: "right", render: v => <span className="text-accent font-semibold">{String(v)}</span> },
  { key: "cpl",         label: "CPL",        align: "right", render: v => { const n = Number(v); return n > 0 ? <span className={`font-semibold ${cplColor(n)}`}>R$ {n.toFixed(2)}</span> : <span className="text-text-muted">—</span>; } },
  { key: "frequency",   label: "Freq.",      align: "right", render: v => v != null ? <span className="text-text-secondary">{Number(v).toFixed(1)}</span> : <span className="text-text-muted">—</span> },
];

export default function CriativosPage() {
  const { platform, period, client } = useDashboard();
  const [view, setView]         = useState<"grid" | "list">("grid");
  const [campaign, setCampaign] = useState<string>("all");
  const [sortBy, setSortBy]     = useState<SortKey>("cpl");
  const [data, setData]         = useState<CreativeRow[]>([]);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    const { since, until } = getPeriodDates(period);
    const { since: leadSince, until: leadUntil } = getLeadDates(period);
    setLoading(true);
    const metaSlug = client !== "all" ? client : null;

    const base = supabase.from("ad_creatives")
      .select("ad_id,ad_name,campaign_name,platform,creative_type,thumbnail_url,video_url,permalink_url,headline,impressions,clicks,spend,frequency,placement")
      .gte("date", since).lte("date", until);
    const q1 = platform !== "all" ? base.eq("platform", platform) : base;
    const qAds = metaSlug ? q1.eq("client_slug", metaSlug) : q1;

    const baseLeads = supabase.from("leads")
      .select("utm_source, utm_term")
      .not("utm_medium", "is", null)
      .gte("converted_at", leadSince)
      .lte("converted_at", leadUntil);
    const qLeads = metaSlug ? baseLeads.eq("client_slug", metaSlug) : baseLeads;

    Promise.all([qAds, qLeads]).then(([{ data: rows }, { data: rawLeads }]) => {
      setLoading(false);

      // Filtra leads pela plataforma selecionada
      const leadsData = platform === "all" ? (rawLeads ?? []) : (rawLeads ?? []).filter((l: any) => {
        const src = (l.utm_source ?? "").toLowerCase();
        if (platform === "meta") return src === "facebook" || src === "fb" || src === "instagram" || src === "ig";
        if (platform === "google") return src === "google";
        return true;
      });

      const byAdName = new Map<string, number>();
      for (const l of leadsData) {
        if (!l.utm_term) continue;
        byAdName.set(l.utm_term, (byAdName.get(l.utm_term) ?? 0) + 1);
      }

      if (rows && rows.length > 0) {
        const map = new Map<string, CreativeRow>();
        for (const r of rows) {
          const key = `${r.platform}:${r.ad_id}`;
          const ex = map.get(key);
          if (ex) { ex.impressions += r.impressions ?? 0; ex.clicks += r.clicks ?? 0; ex.spend += r.spend ?? 0; }
          else { map.set(key, { ad_id: r.ad_id, ad_name: r.ad_name, campaign_name: r.campaign_name ?? "", platform: r.platform as Platform, creative_type: r.creative_type ?? null, thumbnail_url: r.thumbnail_url ?? null, video_url: r.video_url ?? null, permalink_url: r.permalink_url ?? null, headline: r.headline ?? null, placement: r.placement ?? null, impressions: r.impressions ?? 0, clicks: r.clicks ?? 0, spend: r.spend ?? 0, frequency: r.frequency ?? null, leads: 0, cpl: 0, ctr: 0, cpm: 0, video_3s_rate: null, video_thruplay_rate: null }); }
        }
        setData(Array.from(map.values()).map(c => {
          let ld = byAdName.get(c.ad_name) ?? 0;
          if (ld === 0) {
            for (const [utmVal, count] of Array.from(byAdName.entries())) {
              if (fuzzyMatch(c.ad_name, utmVal)) { ld += count; }
            }
          }
          return { ...c, ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0, cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0, leads: ld, cpl: ld > 0 ? c.spend / ld : 0 };
        }));
      } else { setData([]); }
    });
  }, [platform, period, client]);

  const campaigns = ["all", ...Array.from(new Set(data.map(c => c.campaign_name).filter(Boolean)))];
  const filtered = (campaign === "all" ? data : data.filter(c => c.campaign_name === campaign))
    .slice()
    .sort((a, b) => {
      if (sortBy === "cpl" || sortBy === "cpm") return (a[sortBy] ?? 0) - (b[sortBy] ?? 0);
      return (b[sortBy] ?? 0) - (a[sortBy] ?? 0);
    });

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-h-0 p-4 md:p-6 overflow-y-auto">
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Criativos</h1>
            <p className="text-sm text-text-secondary mt-0.5">Performance por anúncio com prévia do criativo</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={campaign} onChange={e => setCampaign(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40 cursor-pointer max-w-[200px] truncate">
              {campaigns.map(c => (<option key={c} value={c}>{c === "all" ? "Todas as campanhas" : c}</option>))}
            </select>
            <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-2.5 py-2">
              <ArrowUpDown size={12} className="text-text-muted flex-shrink-0" />
              <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)}
                className="bg-transparent text-xs text-text-primary focus:outline-none cursor-pointer">
                {sortOptions.map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            </div>
            <div className="flex items-center bg-card border border-border rounded-lg overflow-hidden">
              <button onClick={() => setView("grid")} className={`px-3 py-2 transition-colors ${view === "grid" ? "bg-border text-text-primary" : "text-text-muted hover:text-text-secondary"}`}><LayoutGrid size={14} /></button>
              <button onClick={() => setView("list")} className={`px-3 py-2 transition-colors ${view === "list" ? "bg-border text-text-primary" : "text-text-muted hover:text-text-secondary"}`}><List size={14} /></button>
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
