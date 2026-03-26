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
import { mockClients } from "@/lib/mock-data";
import {
  mockFunnel, mockTrend,
  mockCampaigns,
} from "@/lib/mock-data";
import type { CampaignRow, ProductRow, Platform, KPIData, DonutSlice, HorizontalBarItem } from "@/lib/types";
import { RefreshCw, Calendar } from "lucide-react";

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

const campaignColumns: Column<CampaignRow>[] = [
  {
    key: "campaign_name",
    label: "Campanha",
    render: (v, row) => (
      <div className="flex items-center gap-2">
        <PlatformBadge p={row.platform} />
        <span className="text-text-primary text-xs truncate max-w-[180px]" title={String(v)}>{String(v)}</span>
      </div>
    ),
  },
  { key: "spend",   label: "Invest.", align: "right",
    render: v => <span className="text-blue text-xs">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "revenue", label: "Receita", align: "right",
    render: v => <span className="text-accent text-xs">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "sales",   label: "Vendas",  align: "right",
    render: v => <span className="text-green font-semibold text-xs">{String(v)}</span> },
  { key: "roas",    label: "ROAS",    align: "right",
    render: v => <span className={`font-semibold text-xs ${roasColor(Number(v))}`}>{Number(v).toFixed(2)}×</span> },
];

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
}

function buildKPIs(stats: SalesStats, loading: boolean): KPIData[] {
  const f = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return [
    { label: "Faturamento",     value: loading ? "…" : `R$ ${f(stats.revenue)}`,    color: "accent"  },
    { label: "Gastos Anúncios", value: "R$ 18.740",  trend: +8.2,  color: "blue"    },
    { label: "ROAS",            value: "4,50×",      trend: +3.8,  color: "purple"  },
    { label: "Lucro",           value: loading ? "…" : `R$ ${f(stats.revenue)}`,    color: "accent"  },
    { label: "ROI",             value: "349,9%",     trend: +5.2,  color: "purple"  },
    { label: "Vendas",          value: loading ? "…" : String(stats.sales),         color: "accent"  },
    { label: "CPA",             value: "R$ 60,06",  trend: -9.4,  color: "gold"    },
    { label: "Ticket Médio",    value: loading ? "…" : `R$ ${f(stats.avgTicket)}`,  color: "gold"    },
    { label: "Reembolsos",      value: loading ? "…" : `R$ ${f(stats.refundAmt)}`,  color: "red"     },
    { label: "Taxa Conversão",  value: "1,68%",      trend: +0.3,  color: "blue"    },
  ];
}

interface TrackedProduct { product_id: string; product_name: string | null; gateway: string; }

function buildProductRows(tracked: TrackedProduct[], sales: any[]): ProductRow[] {
  return tracked.map(tp => {
    const ps       = sales.filter(s => s.product_id === tp.product_id);
    const approved = ps.filter(s => s.status === "approved" && s.sale_type === "main");
    const refunded = ps.filter(s => s.status === "refunded" || s.status === "chargeback");
    const revenue  = approved.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    return {
      product_id:   tp.product_id,
      product_name: tp.product_name ?? "Produto sem nome",
      gateway:      tp.gateway as any,
      sales:        approved.length,
      revenue,
      avg_ticket:   approved.length > 0 ? revenue / approved.length : 0,
      refunds:      refunded.length,
      refund_rate:  (approved.length + refunded.length) > 0
        ? (refunded.length / (approved.length + refunded.length)) * 100 : 0,
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
  const { client, setClient, platform, setPlatform, period, setPeriod, campaign, setCampaign } = useDashboard();

  const [stats,         setStats]         = useState<SalesStats>({ revenue: 0, sales: 0, avgTicket: 0, refunds: 0, refundAmt: 0, orderBumps: 0, obRevenue: 0 });
  const [products,      setProducts]      = useState<ProductRow[]>([]);
  const [utmSources,    setUtmSources]    = useState<HorizontalBarItem[]>([]);
  const [paymentDonut,  setPaymentDonut]  = useState<DonutSlice[]>([]);
  const [productDonut,  setProductDonut]  = useState<DonutSlice[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [updatedAt,     setUpdatedAt]     = useState("");

  async function fetchData() {
    setLoading(true);
    const { from, to } = getPeriodDates(period);

    // Produtos rastreados
    const { data: tracked } = await supabase
      .from("tracked_products")
      .select("product_id, product_name, gateway")
      .eq("client_slug", client)
      .eq("active", true);

    const ids = tracked?.map((p: any) => p.product_id) ?? [];

    // Vendas no período (inclui campos para os gráficos)
    const { data: sales } = ids.length > 0
      ? await supabase
          .from("sales")
          .select("id, amount, status, sale_type, product_id, product_name, utm_source, payment_method")
          .eq("client_slug", client)
          .in("product_id", ids)
          .gte("created_at", from)
          .lte("created_at", to)
      : { data: [] };

    const allSales   = sales ?? [];
    const approved   = allSales.filter((s: any) => s.status === "approved");
    const mainSales  = approved.filter((s: any) => s.sale_type === "main");
    const obSales    = approved.filter((s: any) => s.sale_type === "order_bump");
    const refunded   = allSales.filter((s: any) => s.status === "refunded" || s.status === "chargeback");
    const revenue    = mainSales.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    const obRevenue  = obSales.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    const refundAmt  = refunded.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    const avgTicket  = mainSales.length > 0 ? revenue / mainSales.length : 0;

    setStats({ revenue, sales: mainSales.length, avgTicket, refunds: refunded.length, refundAmt, orderBumps: obSales.length, obRevenue });
    setProducts(buildProductRows(tracked ?? [], allSales));
    setUtmSources(buildUTMSources(allSales));
    setPaymentDonut(buildPaymentDonut(allSales));
    setProductDonut(buildProductDonut(tracked ?? [], allSales));
    setUpdatedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [client, period]);

  const kpis = buildKPIs(stats, loading);

  const filteredCampaigns = mockCampaigns
    .filter(c => platform === "all" || c.platform === platform)
    .filter(c => campaign === "all" || c.campaign_id === campaign);

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 overflow-auto">

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-bg/95 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <select
              value={client}
              onChange={e => setClient(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent/50 cursor-pointer"
            >
              {mockClients.map(c => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>

            <div className="flex items-center bg-card border border-border rounded-lg overflow-hidden text-xs font-medium">
              {(["all", "meta", "google"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`px-3 py-1.5 transition-colors ${
                    platform === p ? "bg-accent/10 text-accent" : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {p === "all" ? "Todos" : p === "meta" ? "Meta" : "Google"}
                </button>
              ))}
            </div>

            <select
              value={campaign}
              onChange={e => setCampaign(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent/50 cursor-pointer"
            >
              <option value="all">Todas as campanhas</option>
              {mockCampaigns.map(c => (
                <option key={c.campaign_id} value={c.campaign_id}>{c.campaign_name}</option>
              ))}
            </select>
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

          {/* Mid row */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              <div className="bg-card border border-border rounded-xl p-5 h-full">
                <span className="text-sm font-semibold text-text-primary block mb-3">Campanhas</span>
                <DataTable<CampaignRow> columns={campaignColumns} data={filteredCampaigns} rowKey="campaign_id" />
              </div>
            </div>
            <div className="lg:col-span-1">
              <HorizontalBar title="Conversão por Origem" data={utmSources} valueLabel="vendas por fonte" />
            </div>
            <div className="lg:col-span-1">
              <DonutChart title="Método de Pagamento" data={paymentDonut} centerLabel="vendas" />
            </div>
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              <div className="bg-card border border-border rounded-xl p-5 h-full">
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
            </div>
            <div className="lg:col-span-1">
              <DonutChart title="Vendas por Produto" data={productDonut} centerLabel="total" />
            </div>
            <div className="lg:col-span-1">
              <Funnel steps={mockFunnel} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
