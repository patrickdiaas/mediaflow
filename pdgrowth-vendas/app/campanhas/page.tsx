"use client";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import DataTable, { Column } from "@/components/data-table";
import { useDashboard } from "@/lib/dashboard-context";
import { mockCampaigns } from "@/lib/mock-data";
import type { CampaignRow, Platform } from "@/lib/types";

const PlatformBadge = ({ p }: { p: Platform }) => (
  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${
    p === "meta" ? "text-blue border-blue/30 bg-blue/10" : "text-gold border-gold/30 bg-gold/10"
  }`}>
    {p === "meta" ? "Meta" : "Google"}
  </span>
);

const roasColor = (v: number) =>
  v >= 4.5 ? "text-accent" : v >= 3 ? "text-gold" : "text-red";

const columns: Column<CampaignRow>[] = [
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
    render: v => <span className="text-purple font-semibold">{String(v)}</span> },
  { key: "roas",        label: "ROAS",       align: "right",
    render: v => <span className={`font-semibold ${roasColor(Number(v))}`}>{Number(v).toFixed(2)}×</span> },
  { key: "cpa",         label: "CPA",        align: "right",
    render: v => <span className="text-gold">R$ {Number(v).toFixed(2)}</span> },
];

export default function CampanhasPage() {
  const { platform } = useDashboard();

  const filtered = platform === "all"
    ? mockCampaigns
    : mockCampaigns.filter(c => c.platform === platform);

  const totalSpend   = filtered.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = filtered.reduce((s, c) => s + c.revenue, 0);
  const totalSales   = filtered.reduce((s, c) => s + c.sales, 0);
  const overallRoas  = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <Header title="Campanhas" subtitle="Performance por campanha de anúncios" />

        {/* Summary bar */}
        <div className="flex gap-4 mb-5 p-3 bg-card border border-border rounded-xl text-sm">
          <Stat label="Invest. Total"  value={`R$ ${totalSpend.toLocaleString("pt-BR")}`}   color="text-blue"   />
          <div className="w-px bg-border" />
          <Stat label="Receita Total"  value={`R$ ${totalRevenue.toLocaleString("pt-BR")}`}  color="text-accent" />
          <div className="w-px bg-border" />
          <Stat label="Vendas"         value={String(totalSales)}                            color="text-purple" />
          <div className="w-px bg-border" />
          <Stat label="ROAS Geral"     value={`${overallRoas.toFixed(2)}×`}                  color={roasColor(overallRoas)} />
        </div>

        <DataTable<CampaignRow> columns={columns} data={filtered} rowKey="campaign_id" />
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
