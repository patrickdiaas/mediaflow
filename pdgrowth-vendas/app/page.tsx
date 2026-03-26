"use client";
import { useState } from "react";
import Sidebar from "@/components/sidebar";
import KPICard from "@/components/kpi-card";
import DualAxisChart from "@/components/dual-axis-chart";
import Funnel from "@/components/funnel";
import DonutChart from "@/components/donut-chart";
import HorizontalBar from "@/components/horizontal-bar";
import DataTable, { Column } from "@/components/data-table";
import { useDashboard } from "@/lib/dashboard-context";
import { mockClients } from "@/lib/mock-data";
import {
  mockKPIs, mockFunnel, mockTrend,
  mockPaymentDonut, mockProductDonut, mockUTMSources,
  mockCampaigns, mockProducts,
} from "@/lib/mock-data";
import type { CampaignRow, ProductRow, Platform } from "@/lib/types";
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
    render: v => <span className="text-purple font-semibold text-xs">{String(v)}</span> },
  { key: "roas",    label: "ROAS",    align: "right",
    render: v => <span className={`font-semibold text-xs ${roasColor(Number(v))}`}>{Number(v).toFixed(2)}×</span> },
];

const productColumns: Column<ProductRow>[] = [
  { key: "product_name", label: "Produto",
    render: v => <span className="text-text-primary text-xs">{String(v)}</span> },
  { key: "sales",   label: "Vendas",  align: "right",
    render: v => <span className="text-purple font-semibold text-xs">{String(v)}</span> },
  { key: "revenue", label: "Receita", align: "right",
    render: v => <span className="text-accent text-xs">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "avg_ticket", label: "Ticket", align: "right",
    render: v => <span className="text-gold text-xs">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "refund_rate", label: "Reemb.", align: "right",
    render: v => {
      const n = Number(v);
      return <span className={`text-xs ${n > 5 ? "text-red" : n > 3 ? "text-gold" : "text-accent"}`}>{n.toFixed(1)}%</span>;
    }},
];

export default function OverviewPage() {
  const { client, setClient, platform, setPlatform, period, setPeriod } = useDashboard();
  const [updatedAt] = useState(() =>
    new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  );

  const filteredCampaigns = platform === "all"
    ? mockCampaigns
    : mockCampaigns.filter(c => c.platform === platform);

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
              className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-purple/50 cursor-pointer"
            >
              {mockClients.map(c => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>

            {/* Platform tabs */}
            <div className="flex items-center bg-card border border-border rounded-lg overflow-hidden text-xs font-medium">
              {(["all", "meta", "google"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`px-3 py-1.5 transition-colors ${
                    platform === p ? "bg-purple/20 text-purple" : "text-text-secondary hover:text-text-primary"
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

            <div className="text-xs text-text-muted">
              Atualizado: <span className="font-mono">{updatedAt}</span>
            </div>

            <button className="flex items-center gap-1.5 bg-purple text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-purple/90 transition-colors">
              <RefreshCw size={12} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* KPI Grid — 5 + 5 */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {mockKPIs.slice(0, 5).map(kpi => (
              <KPICard key={kpi.label} {...kpi} />
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {mockKPIs.slice(5).map(kpi => (
              <KPICard key={kpi.label} {...kpi} />
            ))}
          </div>

          {/* Main chart */}
          <DualAxisChart data={mockTrend} />

          {/* Mid row: Campaigns | UTM sources | Payment donut */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              <div className="bg-card border border-border rounded-xl p-5 h-full">
                <span className="text-sm font-semibold text-text-primary block mb-3">Campanhas</span>
                <DataTable<CampaignRow>
                  columns={campaignColumns}
                  data={filteredCampaigns}
                  rowKey="campaign_id"
                />
              </div>
            </div>
            <div className="lg:col-span-1">
              <HorizontalBar
                title="Conversão por Origem"
                data={mockUTMSources}
                valueLabel="vendas por fonte"
              />
            </div>
            <div className="lg:col-span-1">
              <DonutChart
                title="Método de Pagamento"
                data={mockPaymentDonut}
                centerLabel="vendas"
              />
            </div>
          </div>

          {/* Bottom row: Products | Funnel */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              <div className="bg-card border border-border rounded-xl p-5 h-full">
                <span className="text-sm font-semibold text-text-primary block mb-3">Produtos</span>
                <DataTable<ProductRow>
                  columns={productColumns}
                  data={mockProducts}
                  rowKey="product_id"
                />
              </div>
            </div>
            <div className="lg:col-span-1">
              <DonutChart
                title="Vendas por Produto"
                data={mockProductDonut}
                centerLabel="total"
              />
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
