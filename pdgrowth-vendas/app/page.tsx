"use client";
import { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";
import KPICard from "@/components/kpi-card";
import DualAxisChart from "@/components/dual-axis-chart";
import Funnel from "@/components/funnel";
import DonutChart from "@/components/donut-chart";
import HorizontalBar from "@/components/horizontal-bar";
import DataTable, { Column } from "@/components/data-table";
import { useDashboard } from "@/lib/dashboard-context";
import { supabase } from "@/lib/supabase";
import { getPeriodDates } from "@/lib/period";
import { mockFunnel, mockTrend } from "@/lib/mock-data";
import type { ProductRow, Platform, KPIData, DonutSlice, HorizontalBarItem } from "@/lib/types";
import { RefreshCw, Calendar, Building2 } from "lucide-react";

const periods = [
  { value: "today",     label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "last7",     label: "Últimos 7 dias" },
  { value: "last30",    label: "Últimos 30 dias" },
  { value: "thisMonth", label: "Este mês" },
  { value: "lastMonth", label: "Mês passado" },
];

const roasColor = (v: number) =>
  v >= 4.5 ? "text-accent" : v >= 3 ? "text-gold" : "text-red";

const PlatformBadge = ({ p }: { p: Platform }) => (
  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
    p === "meta" ? "text-blue border-blue/30 bg-blue/10" : "text-gold border-gold/30 bg-gold/10"
  }`}>
    {p === "meta" ? "Meta" : "Google"}
  </span>
);


const productColumns: Column<ProductRow>[] = [
  { key: "product_name", label: "Produto",
    render: v => <span className="text-text-primary text-xs">{String(v)}</span> },
  { key: "sales",      label: "Vendas",  align: "right",
    render: v => <span className="text-green font-semibold text-xs">{String(v)}</span> },
  { key: "revenue",    label: "Receita", align: "right",
    render: v => <span className="text-accent text-xs">R$ {Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span> },
  { key: "avg_ticket", label: "Ticket",  align: "right",
    render: v => <span className="text-gold text-xs">R$ {Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span> },
  { key: "refund_rate", label: "Reemb.", align: "right",
    render: v => {
      const n = Number(v);
      return <span className={`text-xs ${n > 5 ? "text-red" : n > 3 ? "text-gold" : "text-accent"}`}>{n.toFixed(1)}%</span>;
    }},
];

// ─── Cores para os gráficos ───────────────────────────────────────────────────
const CHART_COLORS = ["#CAFF04", "#60A5FA", "#F59E0B", "#EF4444", "#A78BFA", "#34D399"];

const PAYMENT_COLORS: Record<string, string> = {
  pix:         "#CAFF04",
  credit_card: "#60A5FA",
  boleto:      "#F59E0B",
  debit_card:  "#34D399",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
interface SalesStats {
  revenue: number; sales: number; avgTicket: number;
  refunds: number; refundAmt: number; orderBumps: number; obRevenue: number;
  spend: number;
}

function buildKPIs(stats: SalesStats, loading: boolean): KPIData[] {
  const f = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalRevenue = stats.revenue + stats.obRevenue;
  const roas  = stats.spend > 0 ? totalRevenue / stats.spend : 0;
  const roi   = stats.spend > 0 ? ((totalRevenue - stats.spend) / stats.spend) * 100 : 0;
  const cpa   = stats.sales > 0 && stats.spend > 0 ? stats.spend / stats.sales : 0;
  const roasC = roas >= 4.5 ? "accent" : roas >= 3 ? "gold" : roas > 0 ? "red" : "gold";
  return [
    { label: "Faturamento",     value: loading ? "…" : `R$ ${f(totalRevenue)}`,                                             color: "accent"  },
    { label: "Gastos Anúncios", value: loading ? "…" : stats.spend > 0 ? `R$ ${f(stats.spend)}` : "—",                     color: "blue"    },
    { label: "ROAS",            value: loading ? "…" : roas > 0 ? `${roas.toFixed(2)}×` : "—",                             color: roasC     },
    { label: "Lucro",           value: loading ? "…" : stats.spend > 0 ? `R$ ${f(totalRevenue - stats.spend)}` : `R$ ${f(totalRevenue)}`, color: "accent" },
    { label: "ROI",             value: loading ? "…" : roi !== 0 ? `${roi.toFixed(1)}%` : "—",                             color: roi >= 0 ? "accent" : "red" },
    { label: "Vendas",          value: loading ? "…" : String(stats.sales),                                                color: "accent"  },
    { label: "CPA",             value: loading ? "…" : cpa > 0 ? `R$ ${f(cpa)}` : "—",                                    color: "gold"    },
    { label: "Ticket Médio",    value: loading ? "…" : `R$ ${f(stats.avgTicket)}`,                                         color: "gold"    },
    { label: "Reembolsos",      value: loading ? "…" : `R$ ${f(stats.refundAmt)}`,                                         color: "red"     },
    { label: "Order Bumps",     value: loading ? "…" : `${stats.orderBumps} · R$ ${f(stats.obRevenue)}`,                   color: "gold"    },
  ];
}

interface TrackedProduct { product_id: string; product_name: string | null; gateway: string; }

function buildProductRows(tracked: TrackedProduct[], sales: any[]): ProductRow[] {
  return tracked.map(tp => {
    const ps       = sales.filter(s => s.product_id === tp.product_id);
    const approved = ps.filter(s => s.status === "approved");
    const refunded = ps.filter(s => s.status === "refunded" || s.status === "chargeback");
    const revenue  = approved.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    return {
      product_id:    tp.product_id,
      product_name:  tp.product_name ?? "Produto sem nome",
      gateway:       tp.gateway as any,
      sales:         approved.length,
      revenue,
      avg_ticket:    approved.length > 0 ? revenue / approved.length : 0,
      refunds:       refunded.length,
      refund_rate:   (approved.length + refunded.length) > 0
        ? (refunded.length / (approved.length + refunded.length)) * 100 : 0,
      is_order_bump: ps.length > 0 && ps.every((s: any) => s.sale_type === "order_bump"),
    };
  });
}

function buildUTMSources(sales: any[]): HorizontalBarItem[] {
  const approved = sales.filter(s => s.status === "approved");
  const total = approved.length;
  if (total === 0) return [];
  const counts: Record<string, number> = {};
  for (const s of approved) {
    const key = s.utm_source || "Direto";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value], i) => ({
      label,
      value,
      rate: (value / total) * 100,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
}

function buildPaymentDonut(sales: any[]): DonutSlice[] {
  const approved = sales.filter(s => s.status === "approved");
  if (approved.length === 0) return [];
  const counts: Record<string, number> = {};
  for (const s of approved) {
    const key = s.payment_method || "outros";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const labels: Record<string, string> = {
    pix: "Pix", credit_card: "Cartão", boleto: "Boleto", debit_card: "Débito",
  };
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value], i) => ({
      label: labels[key] ?? key,
      value,
      color: PAYMENT_COLORS[key] ?? CHART_COLORS[i % CHART_COLORS.length],
    }));
}

function buildProductDonut(tracked: TrackedProduct[], sales: any[]): DonutSlice[] {
  const approved = sales.filter(s => s.status === "approved" && s.sale_type === "main");
  if (approved.length === 0) return [];
  const counts: Record<string, { name: string; count: number }> = {};
  for (const s of approved) {
    const id = s.product_id;
    const name = tracked.find(t => t.product_id === id)?.product_name ?? s.product_name ?? id;
    if (!counts[id]) counts[id] = { name, count: 0 };
    counts[id].count++;
  }
  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((item, i) => ({
      label: item.name,
      value: item.count,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function OverviewPage() {
  const { client, setClient, platform, setPlatform, period, setPeriod } = useDashboard();

  const [clients,       setClients]       = useState<{ slug: string; name: string; display_name: string | null; sales_slug: string | null }[]>([]);
  const [stats,         setStats]         = useState<SalesStats>({ revenue: 0, sales: 0, avgTicket: 0, refunds: 0, refundAmt: 0, orderBumps: 0, obRevenue: 0, spend: 0 });
  const [products,      setProducts]      = useState<ProductRow[]>([]);
  const [utmSources,    setUtmSources]    = useState<HorizontalBarItem[]>([]);
  const [paymentDonut,  setPaymentDonut]  = useState<DonutSlice[]>([]);
  const [productDonut,  setProductDonut]  = useState<DonutSlice[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [updatedAt,     setUpdatedAt]     = useState("");

  useEffect(() => {
    supabase.from("clients").select("slug, name, display_name, sales_slug").eq("active", true).order("name")
      .then(({ data }) => { if (data) setClients(data as { slug: string; name: string; display_name: string | null; sales_slug: string | null }[]); });
  }, []);

  function getSalesSlug(): string | null {
    if (client === "all") return null;
    const found = clients.find(c => c.slug === client);
    return found?.sales_slug ?? client;
  }

  async function fetchData() {
    setLoading(true);
    const { since, until } = getPeriodDates(period);
    const salesSlug = getSalesSlug();

    // Produtos rastreados
    const trackedQ = supabase.from("tracked_products").select("product_id, product_name, gateway").eq("active", true);
    const { data: tracked } = await (salesSlug ? trackedQ.eq("client_slug", salesSlug) : trackedQ);

    const ids = tracked?.map((p: any) => p.product_id) ?? [];

    // Vendas no período
    const salesQ = supabase
      .from("sales")
      .select("id, amount, status, sale_type, product_id, product_name, utm_source, payment_method")
      .gte("created_at", since)
      .lte("created_at", until + "T23:59:59");
    if (salesSlug) salesQ.eq("client_slug", salesSlug);
    if (ids.length > 0) salesQ.in("product_id", ids);

    const { data: sales } = ids.length > 0 ? await salesQ : { data: [] };

    const allSales   = sales ?? [];
    const approved   = allSales.filter((s: any) => s.status === "approved");
    const mainSales  = approved.filter((s: any) => s.sale_type === "main");
    const obSales    = approved.filter((s: any) => s.sale_type === "order_bump");
    const refunded   = allSales.filter((s: any) => s.status === "refunded" || s.status === "chargeback");
    const revenue    = mainSales.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    const obRevenue  = obSales.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    const refundAmt  = refunded.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    const avgTicket  = mainSales.length > 0 ? revenue / mainSales.length : 0;

    // Busca investimento Meta no período
    const metaSlug = client === "all" ? null : client;
    const adQ = supabase.from("ad_campaigns").select("spend")
      .gte("date", since).lte("date", until);
    const { data: adData } = await (metaSlug ? adQ.eq("client_slug", metaSlug) : adQ);
    const spend = (adData ?? []).reduce((sum: number, r: any) => sum + Number(r.spend), 0);

    setStats({ revenue, sales: mainSales.length, avgTicket, refunds: refunded.length, refundAmt, orderBumps: obSales.length, obRevenue, spend });
    setProducts(buildProductRows(tracked ?? [], allSales));
    setUtmSources(buildUTMSources(allSales));
    setPaymentDonut(buildPaymentDonut(allSales));
    setProductDonut(buildProductDonut(tracked ?? [], allSales));
    setUpdatedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [client, period]);

  const kpis = buildKPIs(stats, loading);


  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 overflow-auto">

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-bg/95 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            {clients.length > 0 && (
              <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5">
                <Building2 size={13} className="text-text-muted" />
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
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5">
              <Calendar size={13} className="text-text-muted" />
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
            {updatedAt && (
              <div className="text-xs text-text-muted">
                Atualizado: <span className="font-mono">{updatedAt}</span>
              </div>
            )}
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 bg-accent text-bg text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-accent/90 transition-colors"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {kpis.slice(0, 5).map(kpi => <KPICard key={kpi.label} {...kpi} />)}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {kpis.slice(5).map(kpi => <KPICard key={kpi.label} {...kpi} />)}
          </div>

          {/* Gráfico */}
          <DualAxisChart data={mockTrend} />

          {/* Mid row — 3 gráficos em colunas iguais */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <DonutChart title="Vendas por Produto"      data={productDonut} centerLabel="total" />
            <HorizontalBar title="Conversão por Origem" data={utmSources}   valueLabel="vendas por fonte" />
            <DonutChart title="Método de Pagamento"     data={paymentDonut} centerLabel="vendas" />
          </div>

          {/* Produtos */}
          <div className="bg-card border border-border rounded-xl p-5">
            <span className="text-sm font-semibold text-text-primary block mb-1">Produtos</span>
            {loading ? (
              <div className="flex items-center gap-2 py-8 text-text-muted text-xs">
                <RefreshCw size={13} className="animate-spin" /> Carregando...
              </div>
            ) : products.length === 0 ? (
              <p className="text-text-muted text-xs py-8">Nenhum produto rastreado. Ative em Configurações.</p>
            ) : (
              <DataTable<ProductRow> columns={productColumns} data={products} rowKey="product_id" />
            )}
          </div>

          {/* Funil — destaque em linha própria */}
          <div className="bg-card border border-border rounded-xl p-6">
            <span className="text-sm font-semibold text-text-primary block mb-4">Funil de Conversão</span>
            <Funnel steps={mockFunnel} />
          </div>
        </div>
      </main>
    </div>
  );
}
