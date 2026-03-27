"use client";
import { useEffect, useState, useRef } from "react";
import Sidebar from "@/components/sidebar";
import { supabase } from "@/lib/supabase";
import { useDashboard } from "@/lib/dashboard-context";
import { RefreshCw, Printer, Copy, Check, TrendingUp, TrendingDown, Minus } from "lucide-react";

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtInt(n: number) { return n.toLocaleString("pt-BR"); }

function getWeekRange(offset = 0) {
  const now = new Date();
  const day = now.getDay(); // 0=dom
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { from: monday.toISOString(), to: sunday.toISOString(), monday, sunday };
}

function formatWeekLabel(monday: Date, sunday: Date) {
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit" };
  return `${monday.toLocaleDateString("pt-BR", opts)} – ${sunday.toLocaleDateString("pt-BR", opts)}`;
}

interface WeekStats {
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
  topProducts: { name: string; sales: number; revenue: number }[];
  topCampaigns: { name: string; sales: number; revenue: number; spend?: number }[];
  byDay: { label: string; vendas: number; receita: number }[];
}

function emptyStats(): WeekStats {
  return { revenue: 0, sales: 0, orderBumps: 0, obRevenue: 0, refunds: 0, refundAmt: 0, avgTicket: 0, spend: 0, roas: 0, roi: 0, topProducts: [], topCampaigns: [], byDay: [] };
}

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

async function fetchWeekStats(client: string, from: string, to: string): Promise<WeekStats> {
  const { data: tracked } = await supabase
    .from("tracked_products")
    .select("product_id")
    .eq("client_slug", client)
    .eq("active", true);

  if (!tracked?.length) return emptyStats();
  const ids = tracked.map((p: any) => p.product_id);

  const { data: sales } = await supabase
    .from("sales")
    .select("amount, status, sale_type, product_name, product_id, utm_medium, created_at")
    .eq("client_slug", client)
    .in("product_id", ids)
    .gte("created_at", from)
    .lte("created_at", to);

  if (!sales?.length) return emptyStats();

  const approved = sales.filter((s: any) => s.status === "approved");
  const main     = approved.filter((s: any) => s.sale_type === "main");
  const obs      = approved.filter((s: any) => s.sale_type === "order_bump");
  const refunded = sales.filter((s: any) => s.status === "refunded" || s.status === "chargeback");

  const revenue   = main.reduce((a: number, s: any) => a + Number(s.amount), 0);
  const obRevenue = obs.reduce((a: number, s: any)  => a + Number(s.amount), 0);
  const refundAmt = refunded.reduce((a: number, s: any) => a + Number(s.amount), 0);

  // Top produtos
  const prodMap = new Map<string, { sales: number; revenue: number }>();
  for (const s of approved) {
    const name = s.product_name ?? "Desconhecido";
    const e = prodMap.get(name) ?? { sales: 0, revenue: 0 };
    e.sales++;
    e.revenue += Number(s.amount);
    prodMap.set(name, e);
  }
  const topProducts = Array.from(prodMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Top campanhas (correlacionadas com ad spend via utm_medium)
  const campMap = new Map<string, { sales: number; revenue: number }>();
  for (const s of approved) {
    const name = s.utm_medium ?? "Direto";
    const e = campMap.get(name) ?? { sales: 0, revenue: 0 };
    e.sales++;
    e.revenue += Number(s.amount);
    campMap.set(name, e);
  }

  // Fetch ad spend from ad_campaigns
  const { data: adData } = await supabase
    .from("ad_campaigns")
    .select("campaign_name, spend")
    .eq("client_slug", client)
    .gte("date", from.slice(0, 10))
    .lte("date", to.slice(0, 10));

  const adSpendMap = new Map<string, number>();
  for (const a of (adData ?? [])) {
    adSpendMap.set(a.campaign_name, (adSpendMap.get(a.campaign_name) ?? 0) + Number(a.spend));
  }
  const totalSpend = Array.from(adSpendMap.values()).reduce((a, b) => a + b, 0);

  const topCampaigns = Array.from(campMap.entries())
    .map(([name, v]) => ({ name, ...v, spend: adSpendMap.get(name) ?? 0 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Por dia da semana
  const dayMap = new Map<number, { vendas: number; receita: number }>();
  for (let i = 0; i < 7; i++) dayMap.set(i, { vendas: 0, receita: 0 });
  for (const s of approved) {
    const dow = new Date(s.created_at).getDay();
    const e = dayMap.get(dow)!;
    e.vendas++;
    e.receita += Number(s.amount);
  }
  const byDay = Array.from(dayMap.entries()).map(([i, v]) => ({ label: DAY_LABELS[i], ...v }));

  const totalRevenue = revenue + obRevenue;
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const roi  = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;

  return {
    revenue, sales: main.length, orderBumps: obs.length,
    obRevenue, refunds: refunded.length, refundAmt,
    avgTicket: main.length > 0 ? revenue / main.length : 0,
    spend: totalSpend, roas, roi,
    topProducts, topCampaigns, byDay,
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

export default function RelatoriosPage() {
  const { client } = useDashboard();
  const [weekOffset, setWeekOffset] = useState(0); // 0 = semana atual, -1 = anterior
  const [curr, setCurr] = useState<WeekStats>(emptyStats());
  const [prev, setPrev] = useState<WeekStats>(emptyStats());
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    const w  = getWeekRange(weekOffset);
    const wp = getWeekRange(weekOffset - 1);
    const [c, p] = await Promise.all([
      fetchWeekStats(client, w.from, w.to),
      fetchWeekStats(client, wp.from, wp.to),
    ]);
    setCurr(c);
    setPrev(p);
    setLoading(false);
  }

  useEffect(() => { load(); }, [client, weekOffset]);

  const week  = getWeekRange(weekOffset);
  const label = formatWeekLabel(week.monday, week.sunday);

  function buildTextReport() {
    const totalRev = curr.revenue + curr.obRevenue;
    const prevTotalRevLocal = prev.revenue + prev.obRevenue;
    const revDiff = prevTotalRevLocal > 0 ? ((totalRev - prevTotalRevLocal) / prevTotalRevLocal) * 100 : 0;
    const salesDiff = prev.sales > 0 ? ((curr.sales - prev.sales) / prev.sales) * 100 : 0;

    const lines = [
      `📊 *Relatório Semanal — ${label}*`,
      ``,
      `💰 *Faturamento:* R$ ${fmt(totalRev)}${revDiff !== 0 ? ` (${revDiff > 0 ? "+" : ""}${revDiff.toFixed(0)}% vs semana anterior)` : ""}`,
      `🛒 *Vendas:* ${fmtInt(curr.sales)}${salesDiff !== 0 ? ` (${salesDiff > 0 ? "+" : ""}${salesDiff.toFixed(0)}%)` : ""}`,
      `⬆️ *Order Bumps:* ${curr.orderBumps} · R$ ${fmt(curr.obRevenue)}`,
      `🎫 *Ticket médio:* R$ ${fmt(curr.avgTicket)}`,
      `↩️ *Reembolsos:* ${curr.refunds} · R$ ${fmt(curr.refundAmt)}`,
    ];

    if (curr.spend > 0) {
      lines.push(``, `📈 *Performance de Anúncios*`);
      lines.push(`💸 *Investimento:* R$ ${fmt(curr.spend)}`);
      lines.push(`📊 *ROAS:* ${curr.roas.toFixed(2)}×`);
      lines.push(`💹 *ROI:* ${curr.roi.toFixed(1)}%`);
    }

    lines.push(``, `📦 *Top Produtos:*`);
    lines.push(...curr.topProducts.map((p, i) => `${i + 1}. ${p.name} — ${p.sales}v · R$ ${fmt(p.revenue)}`));

    lines.push(``, `📣 *Top Campanhas:*`);
    lines.push(...curr.topCampaigns.map((c, i) => {
      const roasStr = c.spend && c.spend > 0 ? ` · ROAS ${(c.revenue / c.spend).toFixed(2)}×` : "";
      return `${i + 1}. ${c.name} — ${c.sales}v · R$ ${fmt(c.revenue)}${roasStr}`;
    }));

    return lines.join("\n");
  }

  async function copyReport() {
    await navigator.clipboard.writeText(buildTextReport());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const totalRev = curr.revenue + curr.obRevenue;
  const prevTotalRev = prev.revenue + prev.obRevenue;
  const maxDay = Math.max(...curr.byDay.map(d => d.receita), 1);

  return (
    <div className="flex min-h-screen bg-bg">
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
      <main className="flex-1 p-6 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Relatório Semanal</h1>
            <p className="text-sm text-text-secondary mt-0.5">Resumo de performance por semana</p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button onClick={() => setWeekOffset(w => w - 1)}
              className="px-3 py-1.5 text-xs bg-card border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors">
              ← Anterior
            </button>
            <span className="text-xs font-mono text-text-primary bg-card border border-border px-3 py-1.5 rounded-lg min-w-[150px] text-center">
              {label}
            </span>
            <button onClick={() => setWeekOffset(w => Math.min(w + 1, 0))}
              disabled={weekOffset === 0}
              className="px-3 py-1.5 text-xs bg-card border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40">
              Próxima →
            </button>
            <button onClick={load}
              className="p-1.5 text-text-muted hover:text-text-primary transition-colors">
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
                { label: "Faturamento Total", value: `R$ ${fmt(totalRev)}`,                                    curr: totalRev,          prev: prevTotalRev,      color: "text-accent" },
                { label: "Vendas",            value: fmtInt(curr.sales),                                       curr: curr.sales,        prev: prev.sales,        color: "text-green" },
                { label: "Order Bumps",       value: `${curr.orderBumps} · R$ ${fmt(curr.obRevenue)}`,         curr: curr.orderBumps,   prev: prev.orderBumps,   color: "text-gold" },
                { label: "Ticket Médio",      value: `R$ ${fmt(curr.avgTicket)}`,                              curr: curr.avgTicket,    prev: prev.avgTicket,    color: "text-gold" },
                { label: "Reembolsos",        value: `${curr.refunds} · R$ ${fmt(curr.refundAmt)}`,            curr: curr.refunds,      prev: prev.refunds,      color: "text-red"  },
              ].map(k => (
                <div key={k.label} className="bg-card border border-border rounded-xl p-4">
                  <p className="text-[11px] text-text-muted mb-1">{k.label}</p>
                  <p className={`font-mono font-semibold text-sm ${k.color}`}>{k.value}</p>
                  <div className="mt-1"><Trend curr={k.curr} prev={k.prev} /></div>
                </div>
              ))}
            </div>

            {/* KPIs — anúncios (exibe só se houver dados de spend) */}
            {(curr.spend > 0 || prev.spend > 0) && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="col-span-2 lg:col-span-4 flex items-center gap-2">
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Anúncios (Meta + Google)</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                {[
                  { label: "Investimento",  value: curr.spend > 0 ? `R$ ${fmt(curr.spend)}`     : "—", curr: curr.spend,  prev: prev.spend,  color: "text-blue", invert: true },
                  { label: "ROAS",          value: curr.roas > 0  ? `${curr.roas.toFixed(2)}×`   : "—", curr: curr.roas,   prev: prev.roas,   color: curr.roas >= 3 ? "text-accent" : curr.roas >= 2 ? "text-gold" : "text-red", invert: false },
                  { label: "ROI",           value: curr.roi !== 0 ? `${curr.roi.toFixed(1)}%`    : "—", curr: curr.roi,    prev: prev.roi,    color: curr.roi >= 0 ? "text-accent" : "text-red", invert: false },
                  { label: "Lucro Bruto",   value: curr.spend > 0 ? `R$ ${fmt(totalRev - curr.spend)}` : "—", curr: totalRev - curr.spend, prev: (prev.revenue + prev.obRevenue) - prev.spend, color: "text-accent", invert: false },
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
              <span className="text-sm font-semibold text-text-primary block mb-4">Faturamento por dia da semana</span>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                      const maxRev = curr.topCampaigns[0].revenue;
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
            </div>

            {/* Comparativo */}
            <div className="bg-card border border-border rounded-xl p-5">
              <span className="text-sm font-semibold text-text-primary block mb-3">
                Comparativo vs semana anterior
              </span>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Faturamento", curr: totalRev,        prev: prevTotalRev,    format: (v: number) => `R$ ${fmt(v)}` },
                  { label: "Vendas",      curr: curr.sales,      prev: prev.sales,       format: (v: number) => fmtInt(v) },
                  { label: "Ticket Médio",curr: curr.avgTicket,  prev: prev.avgTicket,  format: (v: number) => `R$ ${fmt(v)}` },
                  { label: "Reembolsos",  curr: curr.refunds,    prev: prev.refunds,    format: (v: number) => fmtInt(v) },
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
