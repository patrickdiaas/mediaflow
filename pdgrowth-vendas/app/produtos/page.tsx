"use client";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import DataTable, { Column } from "@/components/data-table";
import { mockProducts } from "@/lib/mock-data";
import type { ProductRow, Gateway } from "@/lib/types";

const gatewayLabel: Record<Gateway, string> = {
  dmguru:  "DMGuru",
  hotmart: "Hotmart",
  eduzz:   "Eduzz",
};

const gatewayColor: Record<Gateway, string> = {
  dmguru:  "text-purple border-purple/30 bg-purple/10",
  hotmart: "text-gold border-gold/30 bg-gold/10",
  eduzz:   "text-blue border-blue/30 bg-blue/10",
};

const GatewayBadge = ({ g }: { g: Gateway }) => (
  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${gatewayColor[g]}`}>
    {gatewayLabel[g]}
  </span>
);

const columns: Column<ProductRow>[] = [
  {
    key: "product_name",
    label: "Produto",
    render: (v, row) => (
      <div className="flex items-center gap-2">
        <GatewayBadge g={row.gateway} />
        <span className="text-text-primary text-sm">{String(v)}</span>
      </div>
    ),
  },
  { key: "sales",        label: "Vendas",         align: "right",
    render: v => <span className="text-purple font-semibold">{String(v)}</span> },
  { key: "revenue",      label: "Receita",        align: "right",
    render: v => <span className="text-accent">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "avg_ticket",   label: "Ticket Médio",   align: "right",
    render: v => <span className="text-gold">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "refunds",      label: "Reembolsos",     align: "right",
    render: v => <span className="text-red">{String(v)}</span> },
  { key: "refund_rate",  label: "Taxa Reembolso", align: "right",
    render: v => {
      const n = Number(v);
      return <span className={n > 5 ? "text-red" : n > 3 ? "text-gold" : "text-accent"}>{n.toFixed(2)}%</span>;
    }},
];

export default function ProdutosPage() {
  const totalRevenue = mockProducts.reduce((s, p) => s + p.revenue, 0);
  const totalSales   = mockProducts.reduce((s, p) => s + p.sales, 0);
  const totalRefunds = mockProducts.reduce((s, p) => s + p.refunds, 0);

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <Header title="Produtos" subtitle="Receita e performance por produto" />

        {/* Summary */}
        <div className="flex gap-4 mb-5 p-3 bg-card border border-border rounded-xl text-sm">
          <Stat label="Receita Total"  value={`R$ ${totalRevenue.toLocaleString("pt-BR")}`} color="text-accent" />
          <div className="w-px bg-border" />
          <Stat label="Vendas Totais"  value={String(totalSales)}                           color="text-purple" />
          <div className="w-px bg-border" />
          <Stat label="Reembolsos"     value={String(totalRefunds)}                         color="text-red"    />
        </div>

        <DataTable<ProductRow> columns={columns} data={mockProducts} rowKey="product_id" />
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
