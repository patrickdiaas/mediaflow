"use client";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import DataTable, { Column } from "@/components/data-table";
import { mockProducts, mockSales } from "@/lib/mock-data";
import type { ProductRow, SaleRow, Gateway, SaleStatus, SaleType } from "@/lib/types";

// ─── Badges ───────────────────────────────────────────────────────────────────
const gatewayLabel: Record<Gateway, string> = { dmguru: "DMGuru", hotmart: "Hotmart", eduzz: "Eduzz" };
const gatewayColor: Record<Gateway, string> = {
  dmguru:  "text-green border-green/30 bg-green/10",
  hotmart: "text-gold border-gold/30 bg-gold/10",
  eduzz:   "text-blue border-blue/30 bg-blue/10",
};

const statusLabel: Record<SaleStatus, string> = {
  approved:   "Aprovado",
  refunded:   "Reembolso",
  chargeback: "Chargeback",
  pending:    "Pendente",
  cancelled:  "Cancelado",
};
const statusColor: Record<SaleStatus, string> = {
  approved:   "text-accent border-accent/30 bg-accent-dim",
  refunded:   "text-red border-red/30 bg-red/10",
  chargeback: "text-red border-red/30 bg-red-dim",
  pending:    "text-gold border-gold/30 bg-gold/10",
  cancelled:  "text-text-muted border-border bg-bg",
};

const saleTypeLabel: Record<SaleType, string> = {
  main:       "Principal",
  order_bump: "Order Bump",
  upsell:     "Upsell",
};
const saleTypeColor: Record<SaleType, string> = {
  main:       "text-text-secondary border-border bg-bg",
  order_bump: "text-gold border-gold/30 bg-gold/10",
  upsell:     "text-blue border-blue/30 bg-blue/10",
};

const paymentLabel: Record<string, string> = {
  credit_card: "Cartão",
  pix:         "PIX",
  boleto:      "Boleto",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Colunas — tabela de produtos ─────────────────────────────────────────────
const productColumns: Column<ProductRow>[] = [
  {
    key: "product_name",
    label: "Produto",
    render: (v, row) => (
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${gatewayColor[row.gateway]}`}>
          {gatewayLabel[row.gateway]}
        </span>
        <span className="text-text-primary text-sm">{String(v)}</span>
      </div>
    ),
  },
  { key: "sales",       label: "Vendas",        align: "right",
    render: v => <span className="text-green font-semibold">{String(v)}</span> },
  { key: "revenue",     label: "Receita",       align: "right",
    render: v => <span className="text-accent">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "avg_ticket",  label: "Ticket Médio",  align: "right",
    render: v => <span className="text-gold">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "refunds",     label: "Reembolsos",    align: "right",
    render: v => <span className="text-red">{String(v)}</span> },
  { key: "refund_rate", label: "Taxa Reembolso", align: "right",
    render: v => {
      const n = Number(v);
      return <span className={n > 5 ? "text-red" : n > 3 ? "text-gold" : "text-accent"}>{n.toFixed(2)}%</span>;
    }},
];

// ─── Colunas — tabela de transações ───────────────────────────────────────────
const saleColumns: Column<SaleRow>[] = [
  { key: "created_at",     label: "Data",
    render: v => <span className="text-text-secondary text-xs font-mono">{formatDate(String(v))}</span> },
  { key: "gateway",        label: "Gateway",
    render: v => {
      const g = v as Gateway;
      return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${gatewayColor[g]}`}>{gatewayLabel[g]}</span>;
    }},
  { key: "sale_type",      label: "Tipo",
    render: v => {
      const t = v as SaleType;
      return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${saleTypeColor[t]}`}>{saleTypeLabel[t]}</span>;
    }},
  { key: "amount",         label: "Valor",   align: "right",
    render: v => <span className="text-accent font-mono">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "status",         label: "Status",  align: "center",
    render: v => {
      const s = v as SaleStatus;
      return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${statusColor[s]}`}>{statusLabel[s]}</span>;
    }},
  { key: "utm_medium",     label: "Campanha",
    render: v => <span className="text-text-secondary text-xs truncate max-w-[160px] block" title={String(v ?? "")}>{String(v ?? "—")}</span> },
  { key: "utm_campaign",   label: "Conjunto",
    render: v => <span className="text-text-muted text-xs truncate max-w-[140px] block" title={String(v ?? "")}>{String(v ?? "—")}</span> },
  { key: "utm_content",    label: "Criativo",
    render: v => <span className="text-text-muted text-xs truncate max-w-[160px] block" title={String(v ?? "")}>{String(v ?? "—")}</span> },
  { key: "utm_source",     label: "Posição",
    render: v => <span className="text-text-secondary text-xs">{String(v ?? "—")}</span> },
  { key: "payment_method", label: "Pagamento",
    render: v => <span className="text-text-secondary text-xs">{paymentLabel[String(v)] ?? String(v ?? "—")}</span> },
];

// ─── Página ────────────────────────────────────────────────────────────────────
export default function ProdutosPage() {
  const totalRevenue  = mockProducts.reduce((s, p) => s + p.revenue, 0);
  const totalSales    = mockProducts.reduce((s, p) => s + p.sales, 0);
  const totalRefunds  = mockProducts.reduce((s, p) => s + p.refunds, 0);
  const approved      = mockSales.filter(s => s.status === "approved");
  const orderBumps    = approved.filter(s => s.sale_type === "order_bump");
  const totalOB       = orderBumps.reduce((s, v) => s + v.amount, 0);

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <Header title="Produtos" subtitle="Performance por produto e histórico de transações" />

        {/* Summary */}
        <div className="flex flex-wrap gap-4 mb-5 p-3 bg-card border border-border rounded-xl text-sm">
          <Stat label="Receita Total"  value={`R$ ${totalRevenue.toLocaleString("pt-BR")}`}              color="text-accent" />
          <div className="w-px bg-border" />
          <Stat label="Vendas"         value={String(totalSales)}                                        color="text-green"  />
          <div className="w-px bg-border" />
          <Stat label="Order Bumps"    value={`${orderBumps.length} · R$ ${totalOB.toLocaleString("pt-BR")}`} color="text-gold" />
          <div className="w-px bg-border" />
          <Stat label="Reembolsos"     value={String(totalRefunds)}                                      color="text-red"    />
        </div>

        {/* Tabela de produtos */}
        <DataTable<ProductRow> columns={productColumns} data={mockProducts} rowKey="product_id" />

        {/* Transações */}
        <div className="mt-6">
          <span className="text-sm font-semibold text-text-primary block mb-3">Transações</span>
          <DataTable<SaleRow> columns={saleColumns} data={mockSales} rowKey="id" />
        </div>
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
