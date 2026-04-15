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
import { LayoutGrid, List, ArrowUpDown, Download, ExternalLink, BookOpen } from "lucide-react";
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

interface CatalogItem {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  platform: Platform;
  creative_type: string | null;
  thumbnail_url: string | null;
  permalink_url: string | null;
  headline: string | null;
  status: string;
  first_date: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  ctr: number;
  cpl: number;
}

export default function CriativosPage() {
  const { platform, period, client } = useDashboard();
  const [view, setView]         = useState<"grid" | "list" | "catalog">("grid");
  const [campaign, setCampaign] = useState<string>("all");
  const [sortBy, setSortBy]     = useState<SortKey>("cpl");
  const [data, setData]         = useState<CreativeRow[]>([]);
  const [catalogData, setCatalogData] = useState<CatalogItem[]>([]);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    const { since, until } = getPeriodDates(period);
    const { since: leadSince, until: leadUntil } = getLeadDates(period);
    setLoading(true);
    const metaSlug = client !== "all" ? client : null;

    const base = supabase.from("ad_creatives")
      .select("ad_id,ad_name,campaign_name,platform,creative_type,thumbnail_url,video_url,permalink_url,headline,status,impressions,clicks,spend,frequency,placement,date")
      .gte("date", since).lte("date", until);
    const q1 = platform !== "all" ? base.eq("platform", platform) : base;
    const qAds = metaSlug ? q1.eq("client_slug", metaSlug) : q1;

    const baseLeads = supabase.from("leads")
      .select("utm_source, utm_term")
      .not("utm_medium", "is", null)
      .not("utm_medium", "in", '(organic,"(none)",unknown,referral)')
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
        const catMap = new Map<string, { status: string; firstDate: string; permalink: string | null; thumbnail: string | null; headline: string | null; type: string | null; campaign: string; platform: Platform; impressions: number; clicks: number; spend: number }>();
        for (const r of rows) {
          const key = `${r.platform}:${r.ad_id}`;
          const ex = map.get(key);
          if (ex) { ex.impressions += r.impressions ?? 0; ex.clicks += r.clicks ?? 0; ex.spend += r.spend ?? 0; }
          else { map.set(key, { ad_id: r.ad_id, ad_name: r.ad_name, campaign_name: r.campaign_name ?? "", platform: r.platform as Platform, creative_type: r.creative_type ?? null, thumbnail_url: r.thumbnail_url ?? null, video_url: r.video_url ?? null, permalink_url: r.permalink_url ?? null, headline: r.headline ?? null, placement: r.placement ?? null, impressions: r.impressions ?? 0, clicks: r.clicks ?? 0, spend: r.spend ?? 0, frequency: r.frequency ?? null, leads: 0, cpl: 0, ctr: 0, cpm: 0, video_3s_rate: null, video_thruplay_rate: null }); }
          // Catalog: track first date and status
          const ce = catMap.get(key);
          if (ce) {
            ce.impressions += r.impressions ?? 0; ce.clicks += r.clicks ?? 0; ce.spend += r.spend ?? 0;
            if (r.date && r.date < ce.firstDate) ce.firstDate = r.date;
            if (r.status && r.status !== "REMOVED" && r.status !== "PAUSED") ce.status = r.status;
          } else {
            catMap.set(key, { status: r.status ?? "", firstDate: r.date ?? "", permalink: r.permalink_url ?? null, thumbnail: r.thumbnail_url ?? null, headline: r.headline ?? null, type: r.creative_type ?? null, campaign: r.campaign_name ?? "", platform: r.platform as Platform, impressions: r.impressions ?? 0, clicks: r.clicks ?? 0, spend: r.spend ?? 0 });
          }
        }
        const mapped = Array.from(map.entries()).map(([key, c]) => {
          let ld = byAdName.get(c.ad_name) ?? 0;
          if (ld === 0) {
            for (const [utmVal, count] of Array.from(byAdName.entries())) {
              if (fuzzyMatch(c.ad_name, utmVal)) { ld += count; }
            }
          }
          return { ...c, ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0, cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0, leads: ld, cpl: ld > 0 ? c.spend / ld : 0, _key: key };
        });
        setData(mapped);
        // Build catalog
        setCatalogData(mapped.map(c => {
          const cat = catMap.get(c._key);
          return {
            ad_id: c.ad_id, ad_name: c.ad_name, campaign_name: c.campaign_name, platform: c.platform,
            creative_type: cat?.type ?? null, thumbnail_url: cat?.thumbnail ?? null,
            permalink_url: cat?.permalink ?? null, headline: cat?.headline ?? null,
            status: cat?.status ?? "", first_date: cat?.firstDate ?? "",
            impressions: c.impressions, clicks: c.clicks, spend: c.spend,
            leads: c.leads, ctr: c.ctr, cpl: c.cpl,
          };
        }));
      } else { setData([]); setCatalogData([]); }
    });
  }, [platform, period, client]);

  const campaigns = ["all", ...Array.from(new Set(data.map(c => c.campaign_name).filter(Boolean)))];
  const filteredCatalog = (campaign === "all" ? catalogData : catalogData.filter(c => c.campaign_name === campaign))
    .sort((a, b) => b.leads - a.leads || b.spend - a.spend);

  function exportCatalogPDF() {
    const clientName = client === "all" ? "Todos os clientes" : client;
    const items = filteredCatalog;
    const statusLabel = (s: string) => {
      if (!s || s === "ACTIVE" || s === "ENABLED") return "Ativo";
      if (s === "PAUSED") return "Pausado";
      return s;
    };
    const statusColor = (s: string) => {
      if (!s || s === "ACTIVE" || s === "ENABLED") return "#CAFF04";
      if (s === "PAUSED") return "#F59E0B";
      return "#6A6A7A";
    };

    const cardsHtml = items.map(c => `
      <div class="card">
        <div class="card-header">
          <div class="thumb">${c.thumbnail_url
            ? `<img src="${c.thumbnail_url}" alt="${c.ad_name}" />`
            : c.platform === "google"
              ? `<div class="thumb-label" style="color:#F59E0B">Search</div>`
              : `<div class="thumb-label">—</div>`
          }</div>
          <div class="card-info">
            <div class="ad-name">${c.ad_name}</div>
            ${c.headline ? `<div class="headline">${c.headline}</div>` : ""}
            <div class="campaign">${c.campaign_name}</div>
            <div class="meta-row">
              <span class="badge ${c.platform}">${c.platform === "meta" ? "Meta" : "Google"}</span>
              <span class="status" style="color:${statusColor(c.status)}">${statusLabel(c.status)}</span>
              ${c.first_date ? `<span class="date">Desde ${new Date(c.first_date + "T12:00:00").toLocaleDateString("pt-BR")}</span>` : ""}
            </div>
          </div>
        </div>
        <div class="metrics">
          <div class="metric"><span class="metric-val accent">${c.leads}</span><span class="metric-lbl">Leads</span></div>
          <div class="metric"><span class="metric-val">${c.ctr.toFixed(1)}%</span><span class="metric-lbl">CTR</span></div>
          <div class="metric"><span class="metric-val">${c.cpl > 0 ? `R$${c.cpl.toFixed(0)}` : "—"}</span><span class="metric-lbl">CPL</span></div>
          <div class="metric"><span class="metric-val blue">R$${c.spend.toFixed(0)}</span><span class="metric-lbl">Gasto</span></div>
        </div>
        ${c.permalink_url ? `<a class="link" href="${c.permalink_url}" target="_blank">Ver anúncio ↗</a>` : ""}
      </div>
    `).join("");

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
    <title>Catálogo de Criativos — ${clientName}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Inter', system-ui, sans-serif; background: #0e1018; color: #e2e2e8; padding: 40px 32px; max-width: 900px; margin: 0 auto; font-size: 13px; }
      .header { margin-bottom: 28px; }
      .header h1 { font-size: 22px; font-weight: 800; color: #f2f2f5; }
      .header .sub { font-size: 12px; color: #8888a0; margin-top: 4px; }
      .card { background: #14161e; border: 1px solid #24242c; border-radius: 12px; padding: 16px; margin-bottom: 12px; break-inside: avoid; }
      .card-header { display: flex; gap: 14px; margin-bottom: 12px; }
      .thumb { width: 80px; height: 56px; border-radius: 8px; overflow: hidden; background: #0e1018; border: 1px solid #24242c; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
      .thumb img { width: 100%; height: 100%; object-fit: cover; }
      .thumb-label { font-size: 11px; color: #6a6a7a; font-weight: 700; }
      .card-info { flex: 1; min-width: 0; }
      .ad-name { font-size: 13px; font-weight: 700; color: #f2f2f5; margin-bottom: 2px; }
      .headline { font-size: 11px; color: #F59E0B; margin-bottom: 3px; }
      .campaign { font-size: 11px; color: #8888a0; margin-bottom: 4px; }
      .meta-row { display: flex; gap: 8px; align-items: center; }
      .badge { font-size: 10px; font-weight: 700; padding: 1px 8px; border-radius: 6px; }
      .badge.meta { color: #60A5FA; background: rgba(96,165,250,0.1); border: 1px solid rgba(96,165,250,0.3); }
      .badge.google { color: #F59E0B; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); }
      .status { font-size: 10px; font-weight: 600; }
      .date { font-size: 10px; color: #6a6a7a; }
      .metrics { display: flex; gap: 12px; }
      .metric { background: #0e1018; border-radius: 8px; padding: 8px 12px; text-align: center; flex: 1; }
      .metric-val { font-size: 15px; font-weight: 800; display: block; font-family: 'DM Mono', monospace; color: #f2f2f5; }
      .metric-val.accent { color: #CAFF04; }
      .metric-val.blue { color: #60A5FA; }
      .metric-lbl { font-size: 9px; color: #6a6a7a; text-transform: uppercase; letter-spacing: 0.06em; }
      .link { display: inline-block; margin-top: 10px; font-size: 11px; color: #60A5FA; text-decoration: none; }
      .link:hover { text-decoration: underline; }
      .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #24242c; font-size: 10px; color: #4a4a5a; display: flex; justify-content: space-between; }
      @media print { body { padding: 12mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style></head><body>
    <div class="header">
      <h1>Catálogo de Criativos</h1>
      <div class="sub">Cliente: <strong>${clientName}</strong> · ${items.length} criativos · Gerado: ${new Date().toLocaleString("pt-BR")}</div>
    </div>
    ${cardsHtml}
    <div class="footer"><span>PD Growth // leads.pdgrowth.com.br</span><span>${items.length} criativos</span></div>
    </body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }
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
            {view !== "catalog" && (
              <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-2.5 py-2">
                <ArrowUpDown size={12} className="text-text-muted flex-shrink-0" />
                <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)}
                  className="bg-transparent text-xs text-text-primary focus:outline-none cursor-pointer">
                  {sortOptions.map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </div>
            )}
            <div className="flex items-center bg-card border border-border rounded-lg overflow-hidden">
              <button onClick={() => setView("grid")} className={`px-3 py-2 transition-colors ${view === "grid" ? "bg-border text-text-primary" : "text-text-muted hover:text-text-secondary"}`}><LayoutGrid size={14} /></button>
              <button onClick={() => setView("list")} className={`px-3 py-2 transition-colors ${view === "list" ? "bg-border text-text-primary" : "text-text-muted hover:text-text-secondary"}`}><List size={14} /></button>
              <button onClick={() => setView("catalog")} className={`px-3 py-2 transition-colors ${view === "catalog" ? "bg-border text-text-primary" : "text-text-muted hover:text-text-secondary"}`}><BookOpen size={14} /></button>
            </div>
            {view === "catalog" && filteredCatalog.length > 0 && (
              <button onClick={exportCatalogPDF} className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-3 py-2 text-xs text-text-secondary hover:text-accent hover:border-accent/30 transition-colors">
                <Download size={12} /> Exportar PDF
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-text-secondary text-sm py-8 text-center">Carregando...</div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(c => <CreativeCard key={c.ad_id} creative={c} />)}
          </div>
        ) : view === "list" ? (
          <DataTable<CreativeRow> columns={tableColumns} data={filtered} rowKey="ad_id" />
        ) : (
          <div className="space-y-3">
            {filteredCatalog.length === 0 ? (
              <div className="text-text-muted text-sm text-center py-12">Nenhum criativo encontrado no período.</div>
            ) : filteredCatalog.map(c => (
              <div key={c.ad_id} className="bg-card border border-border rounded-xl p-4 flex gap-4 items-start hover:border-border-light transition-colors">
                {/* Thumbnail */}
                <div className="relative w-20 h-14 rounded-lg overflow-hidden bg-bg flex-shrink-0 border border-border">
                  {c.thumbnail_url
                    ? <Image src={c.thumbnail_url} alt={c.ad_name} fill className="object-cover" sizes="80px" unoptimized />
                    : c.platform === "google"
                      ? <div className="w-full h-full flex items-center justify-center text-gold text-[10px] font-bold">Search</div>
                      : <div className="w-full h-full flex items-center justify-center text-text-muted text-[10px]">—</div>
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${
                      c.platform === "meta" ? "text-blue border-blue/30 bg-blue/10" : "text-gold border-gold/30 bg-gold/10"
                    }`}>{c.platform === "meta" ? "Meta" : "Google"}</span>
                    <span className={`text-[10px] font-semibold ${
                      (!c.status || c.status === "ACTIVE" || c.status === "ENABLED") ? "text-accent" : "text-gold"
                    }`}>
                      {(!c.status || c.status === "ACTIVE" || c.status === "ENABLED") ? "Ativo" : c.status === "PAUSED" ? "Pausado" : c.status}
                    </span>
                    {c.first_date && (
                      <span className="text-[10px] text-text-muted">Desde {new Date(c.first_date + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-text-primary truncate" title={c.ad_name}>{c.ad_name}</div>
                  {c.headline && <div className="text-xs text-gold mt-0.5">{c.headline}</div>}
                  <div className="text-xs text-text-muted mt-0.5">{c.campaign_name}</div>

                  {/* Metrics row */}
                  <div className="flex gap-4 mt-2 text-xs">
                    <span><span className="text-accent font-mono font-semibold">{c.leads}</span> <span className="text-text-muted">leads</span></span>
                    <span><span className="text-text-secondary font-mono">{c.ctr.toFixed(1)}%</span> <span className="text-text-muted">CTR</span></span>
                    <span><span className="text-gold font-mono">{c.cpl > 0 ? `R$${c.cpl.toFixed(0)}` : "—"}</span> <span className="text-text-muted">CPL</span></span>
                    <span><span className="text-blue font-mono">R${c.spend.toFixed(0)}</span> <span className="text-text-muted">gasto</span></span>
                  </div>
                </div>

                {/* Link */}
                {c.permalink_url && (
                  <a href={c.permalink_url} target="_blank" rel="noopener noreferrer"
                    className="flex-shrink-0 flex items-center gap-1 text-[11px] text-blue hover:text-accent transition-colors mt-1">
                    <ExternalLink size={12} /> Ver
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
