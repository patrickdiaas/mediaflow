"use client";
import { useEffect, useState, useRef } from "react";
import Sidebar from "@/components/sidebar";
import { supabase } from "@/lib/supabase";
import { useDashboard } from "@/lib/dashboard-context";
import { RefreshCw, Printer, Copy, Check, TrendingUp, TrendingDown, Minus, Building2 } from "lucide-react";

type ReportMode = "weekly" | "monthly";

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtInt(n: number) { return n.toLocaleString("pt-BR"); }

// ─── Ranges ───────────────────────────────────────────────────────────────────

// Fuso horário de Brasília = UTC-3
// Início do dia BRT = 03:00 UTC | Fim do dia BRT = 02:59:59 UTC do dia seguinte

function getWeekRange(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  monday.setUTCHours(3, 0, 0, 0); // 03:00 UTC = 00:00 BRT
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);
  sunday.setUTCHours(2, 59, 59, 999); // 02:59 UTC = 23:59 BRT
  return { from: monday.toISOString(), to: sunday.toISOString(), start: monday, end: sunday };
}

function getMonthRange(offset = 0) {
  const now = new Date();
  const first = new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset, 1, 3, 0, 0, 0));
  const last  = new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset + 1, 1, 2, 59, 59, 999));
  return { from: first.toISOString(), to: last.toISOString(), start: first, end: last };
}

function formatRangeLabel(mode: ReportMode, offset: number) {
  if (mode === "weekly") {
    const { start, end } = getWeekRange(offset);
    const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit" };
    return `${start.toLocaleDateString("pt-BR", opts)} – ${end.toLocaleDateString("pt-BR", opts)}`;
  } else {
    const { start } = getMonthRange(offset);
    return start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      .replace(/^\w/, c => c.toUpperCase());
  }
}

// ─── Stats ────────────────────────────────────────────────────────────────────

interface PeriodStats {
  revenue: number;
  sales: number;
  orderBumps: number;
  obRevenue: number;
  refunds: number;
  refundAmt: number;
  avgTicket: number;
  spend: number;
  roas: number;
  roi: number;
  cpa: number;
  topProducts: { name: string; sales: number; revenue: number }[];
  topCampaigns: { name: string; sales: number; revenue: number; spend?: number }[];
  topCreatives: { name: string; sales: number; revenue: number; spend: number; roas: number; link: string | null }[];
  byDay: { label: string; vendas: number; receita: number }[];
}

function emptyStats(): PeriodStats {
  return { revenue: 0, sales: 0, orderBumps: 0, obRevenue: 0, refunds: 0, refundAmt: 0,
    avgTicket: 0, spend: 0, roas: 0, roi: 0, cpa: 0, topProducts: [], topCampaigns: [], topCreatives: [], byDay: [] };
}

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

async function fetchPeriodStats(salesSlug: string | null, metaSlug: string | null, from: string, to: string): Promise<PeriodStats> {
  const trackedQ = supabase.from("tracked_products").select("product_id").eq("active", true);
  const { data: tracked } = await (salesSlug ? trackedQ.eq("client_slug", salesSlug) : trackedQ);

  if (!tracked?.length) return emptyStats();
  const ids = tracked.map((p: any) => p.product_id);

  const salesQ = supabase
    .from("sales")
    .select("amount, amount_net, status, sale_type, product_name, product_id, utm_medium, utm_content, created_at")
    .in("product_id", ids)
    .gte("created_at", from)
    .lte("created_at", to);
  const { data: sales } = await (salesSlug ? salesQ.eq("client_slug", salesSlug) : salesQ);

  if (!sales?.length) return emptyStats();

  const approved = sales.filter((s: any) => s.status === "approved");
  const main     = approved.filter((s: any) => s.sale_type === "main");
  const obs      = approved.filter((s: any) => s.sale_type === "order_bump");
  const refunded = sales.filter((s: any) => s.status === "refunded" || s.status === "chargeback");

  const net = (s: any) => Number(s.amount_net ?? s.amount);

  const revenue   = main.reduce((a: number, s: any) => a + net(s), 0);
  const obRevenue = obs.reduce((a: number, s: any)  => a + net(s), 0);
  const refundAmt = refunded.reduce((a: number, s: any) => a + Number(s.amount), 0);

  const prodMap = new Map<string, { sales: number; revenue: number }>();
  for (const s of approved) {
    const name = s.product_name ?? "Desconhecido";
    const e = prodMap.get(name) ?? { sales: 0, revenue: 0 };
    e.sales++;
    e.revenue += net(s);
    prodMap.set(name, e);
  }
  const topProducts = Array.from(prodMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const campMap   = new Map<string, { sales: number; revenue: number }>();
  const adNameMap = new Map<string, { sales: number; revenue: number }>();
  for (const s of main) {
    const camp = s.utm_medium ?? "Direto";
    const ce = campMap.get(camp) ?? { sales: 0, revenue: 0 };
    ce.sales++; ce.revenue += net(s);
    campMap.set(camp, ce);

    if (s.utm_content) {
      const ae = adNameMap.get(s.utm_content) ?? { sales: 0, revenue: 0 };
      ae.sales++; ae.revenue += net(s);
      adNameMap.set(s.utm_content, ae);
    }
  }

  // Ad spend — Meta Ads (campanhas + criativos com link)
  const adQ  = supabase.from("ad_campaigns").select("campaign_name, spend")
    .gte("date", from.slice(0, 10)).lte("date", to.slice(0, 10));
  const adCrQ = supabase.from("ad_creatives").select("ad_name, spend, impressions, clicks, permalink_url, video_url")
    .gte("date", from.slice(0, 10)).lte("date", to.slice(0, 10));
  const [{ data: adData }, { data: adCreativeData }] = await Promise.all([
    metaSlug ? adQ.eq("client_slug", metaSlug) : adQ,
    metaSlug ? adCrQ.eq("client_slug", metaSlug) : adCrQ,
  ]);

  const adSpendMap = new Map<string, number>();
  for (const a of (adData ?? [])) {
    adSpendMap.set(a.campaign_name, (adSpendMap.get(a.campaign_name) ?? 0) + Number(a.spend));
  }
  const totalSpend = Array.from(adSpendMap.values()).reduce((a, b) => a + b, 0);

  // Spend e link por nome de criativo
  const creativeSpendMap = new Map<string, { spend: number; link: string | null }>();
  for (const a of (adCreativeData ?? [])) {
    const ex = creativeSpendMap.get(a.ad_name) ?? { spend: 0, link: a.permalink_url ?? a.video_url ?? null };
    ex.spend += Number(a.spend);
    creativeSpendMap.set(a.ad_name, ex);
  }

  const topCampaigns = Array.from(campMap.entries())
    .map(([name, v]) => ({ name, ...v, spend: adSpendMap.get(name) ?? 0 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Top criativos: cruzado via utm_content
  const topCreatives = Array.from(adNameMap.entries())
    .map(([name, v]: [string, { sales: number; revenue: number }]) => {
      const cr    = creativeSpendMap.get(name);
      const spend = cr?.spend ?? 0;
      return { name, sales: v.sales, revenue: v.revenue, spend, roas: spend > 0 ? v.revenue / spend : 0, link: cr?.link ?? null };
    })
    .filter((c: any) => c.sales > 0 || c.spend > 0)
    .sort((a: any, b: any) => b.revenue - a.revenue)
    .slice(0, 5);

  // Por dia da semana
  const dayMap = new Map<number, { vendas: number; receita: number }>();
  for (let i = 0; i < 7; i++) dayMap.set(i, { vendas: 0, receita: 0 });
  for (const s of approved) {
    const dow = new Date(s.created_at).getDay();
    const e = dayMap.get(dow)!;
    e.vendas++;
    e.receita += net(s);
  }
  const byDay = Array.from(dayMap.entries()).map(([i, v]) => ({ label: DAY_LABELS[i], ...v }));

  const totalRevenue = revenue + obRevenue;
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const roi  = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
  const cpa  = main.length > 0 && totalSpend > 0 ? totalSpend / main.length : 0;

  return {
    revenue, sales: main.length, orderBumps: obs.length,
    obRevenue, refunds: refunded.length, refundAmt,
    avgTicket: main.length > 0 ? revenue / main.length : 0,
    spend: totalSpend, roas, roi, cpa,
    topProducts, topCampaigns, topCreatives, byDay,
  };
}

function Trend({ curr, prev }: { curr: number; prev: number }) {
  if (prev === 0) return null;
  const pct = ((curr - prev) / prev) * 100;
  if (Math.abs(pct) < 0.5) return <Minus size={12} className="text-text-muted" />;
  return pct > 0
    ? <span className="flex items-center gap-0.5 text-accent text-xs"><TrendingUp size={12} />{pct.toFixed(0)}%</span>
    : <span className="flex items-center gap-0.5 text-red text-xs"><TrendingDown size={12} />{Math.abs(pct).toFixed(0)}%</span>;
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const { client, setClient } = useDashboard();
  const [reportMode, setReportMode] = useState<ReportMode>("weekly");
  const [offset, setOffset]         = useState(0);
  const [curr, setCurr]             = useState<PeriodStats>(emptyStats());
  const [prev, setPrev]             = useState<PeriodStats>(emptyStats());
  const [loading, setLoading]       = useState(true);
  const [copied, setCopied]         = useState(false);
  const [clients, setClients]       = useState<{ slug: string; name: string; display_name: string | null; sales_slug: string | null }[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("clients").select("slug, name, display_name, sales_slug")
      .eq("active", true).order("name")
      .then(({ data }) => { if (data) setClients(data); });
  }, []);

  function getSlugs() {
    if (client === "all") return { salesSlug: null, metaSlug: null };
    const found = clients.find(c => c.slug === client);
    return { salesSlug: found?.sales_slug ?? client, metaSlug: client };
  }

  function getRange(off: number) {
    return reportMode === "weekly" ? getWeekRange(off) : getMonthRange(off);
  }

  async function load() {
    setLoading(true);
    const { salesSlug, metaSlug } = getSlugs();
    const curr = getRange(offset);
    const prevR = getRange(offset - 1);
    const [c, p] = await Promise.all([
      fetchPeriodStats(salesSlug, metaSlug, curr.from, curr.to),
      fetchPeriodStats(salesSlug, metaSlug, prevR.from, prevR.to),
    ]);
    setCurr(c);
    setPrev(p);
    setLoading(false);
  }

  useEffect(() => { load(); }, [client, reportMode, offset, clients]);

  // Reset offset when switching mode
  function switchMode(mode: ReportMode) {
    setOffset(0);
    setReportMode(mode);
  }

  const label    = formatRangeLabel(reportMode, offset);
  const prevLabel = formatRangeLabel(reportMode, offset - 1);
  const totalRev  = curr.revenue + curr.obRevenue;
  const prevTotalRev = prev.revenue + prev.obRevenue;
  const maxDay = Math.max(...curr.byDay.map(d => d.receita), 1);
  const clientName = client === "all" ? "Todas as contas"
    : (clients.find(c => c.slug === client)?.display_name ?? clients.find(c => c.slug === client)?.name ?? client);

  function buildTextReport() {
    const revDiff   = prevTotalRev > 0 ? ((totalRev - prevTotalRev) / prevTotalRev) * 100 : 0;
    const salesDiff = prev.sales > 0 ? ((curr.sales - prev.sales) / prev.sales) * 100 : 0;
    const lucro     = curr.spend > 0 ? totalRev - curr.spend : null;

    const lines = [
      `📊 *Relatório ${reportMode === "weekly" ? "Semanal" : "Mensal"} — ${label}*`,
      client !== "all" ? `🏢 ${clientName}` : "",
      ``,
      `💰 *Faturamento:* R$ ${fmt(totalRev)}${revDiff !== 0 ? ` (${revDiff > 0 ? "+" : ""}${revDiff.toFixed(0)}% vs ${reportMode === "weekly" ? "semana" : "mês"} anterior)` : ""}`,
      `🛒 *Vendas:* ${fmtInt(curr.sales)}${salesDiff !== 0 ? ` (${salesDiff > 0 ? "+" : ""}${salesDiff.toFixed(0)}%)` : ""}`,
      `🎫 *Ticket médio:* R$ ${fmt(curr.avgTicket)}`,
      curr.orderBumps > 0 ? `⬆️ *Order Bumps:* ${curr.orderBumps} · R$ ${fmt(curr.obRevenue)}` : "",
      curr.refunds > 0    ? `↩️ *Reembolsos:* ${curr.refunds} · R$ ${fmt(curr.refundAmt)}` : "",
    ].filter(l => l !== "");

    if (curr.spend > 0) {
      lines.push(``, `📈 *Meta Ads*`);
      lines.push(`💸 *Investimento:* R$ ${fmt(curr.spend)}`);
      lines.push(`📊 *ROAS:* ${curr.roas.toFixed(2)}×`);
      lines.push(`💹 *ROI:* ${curr.roi.toFixed(1)}%`);
      if (lucro !== null) lines.push(`💵 *Lucro bruto:* R$ ${fmt(lucro)}`);
      if (curr.cpa > 0)   lines.push(`🎯 *CPA:* R$ ${fmt(curr.cpa)}`);
    }

    if (curr.topProducts.length > 0) {
      lines.push(``, `📦 *Top Produtos:*`);
      lines.push(...curr.topProducts.map((p, i) => `${i + 1}. ${p.name} — ${p.sales}v · R$ ${fmt(p.revenue)}`));
    }

    if (curr.topCampaigns.length > 0) {
      lines.push(``, `📣 *Top Campanhas:*`);
      lines.push(...curr.topCampaigns.map((c, i) => {
        const roasStr = c.spend && c.spend > 0 ? ` · ROAS ${(c.revenue / c.spend).toFixed(2)}×` : "";
        return `${i + 1}. ${c.name} — ${c.sales}v · R$ ${fmt(c.revenue)}${roasStr}`;
      }));
    }

    if (curr.topCreatives.length > 0) {
      lines.push(``, `🎨 *Top Criativos:*`);
      lines.push(...curr.topCreatives.map((c, i) => {
        const roasStr = c.roas > 0 ? ` · ROAS ${c.roas.toFixed(2)}×` : "";
        const linkStr = c.link ? ` 🔗 ${c.link}` : "";
        return `${i + 1}. ${c.name} — ${c.sales}v · R$ ${fmt(c.revenue)}${roasStr}${linkStr}`;
      }));
    }

    return lines.join("\n");
  }

  async function copyReport() {
    await navigator.clipboard.writeText(buildTextReport());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex h-screen bg-bg">
      <style>{`
        @media print {
          aside, .no-print { display: none !important; }
          main { padding: 0 !important; }
          body { background: white !important; color: black !important; }
          .bg-card, .bg-bg { background: white !important; border-color: #e5e7eb !important; }
          .text-accent { color: #16a34a !important; }
          .text-blue { color: #2563eb !important; }
          .text-gold { color: #b45309 !important; }
          .text-red { color: #dc2626 !important; }
          .text-text-primary { color: #111827 !important; }
          .text-text-secondary { color: #4b5563 !important; }
          .text-text-muted { color: #9ca3af !important; }
        }
      `}</style>
      <Sidebar />
      <main className="flex-1 p-4 md:p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Relatórios</h1>
            <p className="text-sm text-text-secondary mt-0.5">Performance semanal e mensal</p>
          </div>
          <div className="flex items-center gap-2 no-print flex-wrap">
            {/* Seletor de cliente */}
            {clients.length > 0 && (
              <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
                <Building2 size={14} className="text-text-muted" />
                <select
                  value={client}
                  onChange={e => setClient(e.target.value)}
                  className="bg-transparent text-xs text-text-primary focus:outline-none cursor-pointer max-w-[180px]"
                >
                  <option value="all">Todas as contas</option>
                  {clients.map(c => (
                    <option key={c.slug} value={c.slug}>{c.display_name ?? c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Modo: Semanal / Mensal */}
            <div className="flex items-center bg-card border border-border rounded-lg overflow-hidden text-xs font-medium">
              {(["weekly", "monthly"] as ReportMode[]).map(m => (
                <button key={m} onClick={() => switchMode(m)}
                  className={`px-3 py-2 transition-colors ${reportMode === m ? "bg-accent/10 text-accent" : "text-text-secondary hover:text-text-primary"}`}>
                  {m === "weekly" ? "Semanal" : "Mensal"}
                </button>
              ))}
            </div>

            {/* Navegação de período */}
            <button onClick={() => setOffset(o => o - 1)}
              className="px-3 py-1.5 text-xs bg-card border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors">
              ← Anterior
            </button>
            <span className="text-xs font-mono text-text-primary bg-card border border-border px-3 py-1.5 rounded-lg min-w-[160px] text-center">
              {label}
            </span>
            <button onClick={() => setOffset(o => Math.min(o + 1, 0))}
              disabled={offset === 0}
              className="px-3 py-1.5 text-xs bg-card border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40">
              Próximo →
            </button>

            <button onClick={load} className="p-1.5 text-text-muted hover:text-text-primary transition-colors">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-card border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors">
              <Printer size={13} /> Imprimir
            </button>
            <button onClick={copyReport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent text-bg font-semibold rounded-lg hover:bg-accent/90 transition-colors">
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copiado!" : "Copiar para WhatsApp"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-text-muted text-sm gap-2">
            <RefreshCw size={15} className="animate-spin" /> Carregando...
          </div>
        ) : (
          <div ref={reportRef} className="space-y-4">
            {/* KPIs — vendas */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: "Faturamento Total", value: `R$ ${fmt(totalRev)}`,                          curr: totalRev,        prev: prevTotalRev,    color: "text-accent" },
                { label: "Vendas",            value: fmtInt(curr.sales),                             curr: curr.sales,      prev: prev.sales,      color: "text-accent" },
                { label: "Order Bumps",       value: `${curr.orderBumps} · R$ ${fmt(curr.obRevenue)}`, curr: curr.orderBumps, prev: prev.orderBumps, color: "text-gold" },
                { label: "Ticket Médio",      value: `R$ ${fmt(curr.avgTicket)}`,                    curr: curr.avgTicket,  prev: prev.avgTicket,  color: "text-gold" },
                { label: "Reembolsos",        value: `${curr.refunds} · R$ ${fmt(curr.refundAmt)}`,  curr: curr.refunds,    prev: prev.refunds,    color: "text-red"  },
              ].map(k => (
                <div key={k.label} className="bg-card border border-border rounded-xl p-4">
                  <p className="text-[11px] text-text-muted mb-1">{k.label}</p>
                  <p className={`font-mono font-semibold text-sm ${k.color}`}>{k.value}</p>
                  <div className="mt-1"><Trend curr={k.curr} prev={k.prev} /></div>
                </div>
              ))}
            </div>

            {/* KPIs — Meta Ads (só exibe se houver spend) */}
            {(curr.spend > 0 || prev.spend > 0) && (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="col-span-2 lg:col-span-5 flex items-center gap-2">
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Meta Ads</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                {[
                  { label: "Investimento", value: curr.spend > 0 ? `R$ ${fmt(curr.spend)}` : "—",  curr: curr.spend, prev: prev.spend, color: "text-blue" },
                  { label: "ROAS",  value: curr.roas > 0 ? `${curr.roas.toFixed(2)}×` : "—",        curr: curr.roas,  prev: prev.roas,  color: curr.roas >= 3 ? "text-accent" : curr.roas >= 2 ? "text-gold" : "text-red" },
                  { label: "ROI",   value: curr.roi !== 0 ? `${curr.roi.toFixed(1)}%` : "—",         curr: curr.roi,   prev: prev.roi,   color: curr.roi >= 0 ? "text-accent" : "text-red" },
                  { label: "Lucro Bruto", value: curr.spend > 0 ? `R$ ${fmt(totalRev - curr.spend)}` : "—", curr: totalRev - curr.spend, prev: prevTotalRev - prev.spend, color: "text-accent" },
                  { label: "CPA",   value: curr.cpa > 0 ? `R$ ${fmt(curr.cpa)}` : "—",              curr: curr.cpa,   prev: prev.cpa,   color: "text-gold" },
                ].map(k => (
                  <div key={k.label} className="bg-card border border-border rounded-xl p-4">
                    <p className="text-[11px] text-text-muted mb-1">{k.label}</p>
                    <p className={`font-mono font-semibold text-sm ${k.color}`}>{k.value}</p>
                    <div className="mt-1"><Trend curr={k.curr} prev={k.prev} /></div>
                  </div>
                ))}
              </div>
            )}

            {/* Faturamento por dia da semana */}
            <div className="bg-card border border-border rounded-xl p-5">
              <span className="text-sm font-semibold text-text-primary block mb-4">
                Faturamento por dia da semana
              </span>
              <div className="flex items-end gap-2 h-24">
                {curr.byDay.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-mono text-text-secondary">
                      {d.receita > 0 ? `R$${(d.receita / 1000).toFixed(1)}k` : ""}
                    </span>
                    <div className="w-full rounded-t-sm" style={{
                      height: `${Math.max((d.receita / maxDay) * 72, d.receita > 0 ? 4 : 0)}px`,
                      background: d.receita > 0 ? "#CAFF04" : "#1E2433",
                      opacity: d.receita > 0 ? 0.7 : 1,
                    }} />
                    <span className="text-[10px] text-text-muted">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Top Produtos */}
              <div className="bg-card border border-border rounded-xl p-5">
                <span className="text-sm font-semibold text-text-primary block mb-3">Top Produtos</span>
                {curr.topProducts.length === 0 ? (
                  <p className="text-text-muted text-xs py-4 text-center">Sem dados no período.</p>
                ) : (
                  <div className="space-y-3">
                    {curr.topProducts.map((p, i) => (
                      <div key={i} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-mono text-text-muted w-4">{i + 1}</span>
                          <span className="text-xs text-text-primary truncate">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-xs text-text-muted font-mono">{p.sales}v</span>
                          <span className="text-xs text-accent font-mono font-semibold">R$ {fmt(p.revenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top Campanhas */}
              <div className="bg-card border border-border rounded-xl p-5">
                <span className="text-sm font-semibold text-text-primary block mb-3">Top Campanhas</span>
                {curr.topCampaigns.length === 0 ? (
                  <p className="text-text-muted text-xs py-4 text-center">Sem dados no período.</p>
                ) : (
                  <div className="space-y-3">
                    {curr.topCampaigns.map((c, i) => {
                      const maxRev   = curr.topCampaigns[0].revenue;
                      const campRoas = c.spend && c.spend > 0 ? c.revenue / c.spend : null;
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[10px] font-mono text-text-muted w-4">{i + 1}</span>
                              <span className="text-xs text-text-primary truncate" title={c.name}>{c.name}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="text-xs text-text-muted font-mono">{c.sales}v</span>
                              {campRoas !== null && (
                                <span className={`text-xs font-mono ${campRoas >= 3 ? "text-accent" : campRoas >= 2 ? "text-gold" : "text-red"}`}>
                                  {campRoas.toFixed(2)}×
                                </span>
                              )}
                              <span className="text-xs text-accent font-mono font-semibold">R$ {fmt(c.revenue)}</span>
                            </div>
                          </div>
                          <div className="h-1 bg-border rounded-full overflow-hidden ml-6">
                            <div className="h-full rounded-full bg-blue/60" style={{ width: `${(c.revenue / maxRev) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top Criativos */}
              <div className="bg-card border border-border rounded-xl p-5">
                <span className="text-sm font-semibold text-text-primary block mb-3">Top Criativos</span>
                {curr.topCreatives.length === 0 ? (
                  <p className="text-text-muted text-xs py-4 text-center">Sem dados no período.</p>
                ) : (
                  <div className="space-y-3">
                    {curr.topCreatives.map((c, i) => {
                      const maxRev = curr.topCreatives[0].revenue;
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[10px] font-mono text-text-muted w-4">{i + 1}</span>
                              <span className="text-xs text-text-primary truncate" title={c.name}>{c.name}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="text-xs text-text-muted font-mono">{c.sales}v</span>
                              {c.roas > 0 && (
                                <span className={`text-xs font-mono ${c.roas >= 3 ? "text-accent" : c.roas >= 2 ? "text-gold" : "text-red"}`}>
                                  {c.roas.toFixed(2)}×
                                </span>
                              )}
                              <span className="text-xs text-accent font-mono font-semibold">R$ {fmt(c.revenue)}</span>
                              {c.link && (
                                <a href={c.link} target="_blank" rel="noopener noreferrer"
                                  className="text-text-muted hover:text-accent transition-colors flex-shrink-0"
                                  title="Ver criativo">
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                </a>
                              )}
                            </div>
                          </div>
                          <div className="h-1 bg-border rounded-full overflow-hidden ml-6">
                            <div className="h-full rounded-full bg-accent/50" style={{ width: `${(c.revenue / maxRev) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Comparativo */}
            <div className="bg-card border border-border rounded-xl p-5">
              <span className="text-sm font-semibold text-text-primary block mb-3">
                Comparativo vs {reportMode === "weekly" ? "semana" : "mês"} anterior
                <span className="text-text-muted font-normal text-xs ml-2">({prevLabel})</span>
              </span>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Faturamento",  curr: totalRev,       prev: prevTotalRev,   format: (v: number) => `R$ ${fmt(v)}` },
                  { label: "Vendas",       curr: curr.sales,     prev: prev.sales,     format: (v: number) => fmtInt(v) },
                  { label: "Ticket Médio", curr: curr.avgTicket, prev: prev.avgTicket, format: (v: number) => `R$ ${fmt(v)}` },
                  { label: "Reembolsos",   curr: curr.refunds,   prev: prev.refunds,   format: (v: number) => fmtInt(v) },
                ].map(r => {
                  const diff = r.prev > 0 ? ((r.curr - r.prev) / r.prev) * 100 : 0;
                  const up = diff > 0;
                  return (
                    <div key={r.label} className="flex flex-col gap-1">
                      <span className="text-[11px] text-text-muted">{r.label}</span>
                      <span className="text-sm font-mono font-semibold text-text-primary">{r.format(r.curr)}</span>
                      <span className="text-[11px] text-text-muted">vs {r.format(r.prev)}</span>
                      {r.prev > 0 && (
                        <span className={`text-xs font-semibold ${r.label === "Reembolsos" ? (up ? "text-red" : "text-accent") : (up ? "text-accent" : "text-red")}`}>
                          {up ? "+" : ""}{diff.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
