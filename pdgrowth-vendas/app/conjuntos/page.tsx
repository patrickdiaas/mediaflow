"use client";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import DataTable, { Column } from "@/components/data-table";
import { useDashboard } from "@/lib/dashboard-context";
import { mockAdSets } from "@/lib/mock-data";
import type { AdSetRow, Platform } from "@/lib/types";

const PlatformBadge = ({ p }: { p: Platform }) => (
  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${
    p === "meta" ? "text-blue border-blue/30 bg-blue/10" : "text-gold border-gold/30 bg-gold/10"
  }`}>
    {p === "meta" ? "Meta" : "Google"}
  </span>
);

const roasColor = (v: number) =>
  v >= 4.5 ? "text-accent" : v >= 3 ? "text-gold" : "text-red";

const columns: Column<AdSetRow>[] = [
  {
    key: "ad_set_name",
    label: "Conjunto",
    render: (v, row) => (
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <PlatformBadge p={row.platform} />
          <span className="text-text-primary text-sm">{String(v)}</span>
        </div>
        <span className="text-xs text-text-muted pl-0.5">{row.campaign_name}</span>
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

export default function ConjuntosPage() {
  const { platform } = useDashboard();

  const filtered = platform === "all"
    ? mockAdSets
    : mockAdSets.filter(s => s.platform === platform);

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 p-4 md:p-6 overflow-y-auto">
        <Header title="Conjuntos de Anúncios" subtitle="Performance por conjunto (ad set)" />
        <DataTable<AdSetRow> columns={columns} data={filtered} rowKey="ad_set_id" />
      </main>
    </div>
  );
}
