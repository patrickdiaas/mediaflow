"use client";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import DataTable, { Column } from "@/components/data-table";
import { mockSales } from "@/lib/mock-data";
import type { SaleRow, Gateway, SaleStatus, SaleType } from "@/lib/types";

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

const columns: Column<SaleRow>[] = [
  {
    key: "created_at",
    label: "Data",
    render: v => <span className="text-text-secondary text-xs font-mono">{formatDate(String(v))}</span>,
  },
  {
    key: "gateway",
    label: "Gateway",
    render: v => {
      const g = v as Gateway;
      return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${gatewayColor[g]}`}>{gatewayLabel[g]}</span>;
    },
  },
  {
    key: "sale_type",
    label: "Tipo",
    render: v => {
      const t = v as SaleType;
      return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${saleTypeColor[t]}`}>{saleTypeLabel[t]}</span>;
    },
  },
  {
    key: "amount",
    label: "Valor",
    align: "right",
    render: v => <span className="text-accent font-mono">R$ {Number(v).toLocaleString("pt-BR")}</span>,
  },
  {
    key: "status",
    label: "Status",
    align: "center",
    render: v => {
      const s = v as SaleStatus;
      return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${statusColor[s]}`}>{statusLabel[s]}</span>;
    },
  },
  {
    key: "utm_campaign",
    label: "Campanha UTM",
    render: v => <span className="text-text-muted text-xs truncate max-w-[180px] block" title={String(v ?? "")}>{String(v ?? "—")}</span>,
  },
  {
    key: "utm_source",
    label: "Origem",
    render: v => <span className="text-text-secondary text-xs capitalize">{String(v ?? "—")}</span>,
  },
  {
    key: "payment_method",
    label: "Pagamento",
    render: v => <span className="text-text-secondary text-xs">{paymentLabel[String(v)] ?? String(v ?? "—")}</span>,
  },
];

export default function VendasPage() {
  const approved    = mockSales.filter(s => s.status === "approved");
  const refunds     = mockSales.filter(s => s.status === "refunded" || s.status === "chargeback");
  const orderBumps  = mockSales.filter(s => s.sale_type === "order_bump");
  const totalRev    = approved.reduce((s, v) => s + v.amount, 0);
  const totalRef    = refunds.reduce((s, v) => s + v.amount, 0);
  const totalOB     = orderBumps.filter(s => s.status === "approved").reduce((s, v) => s + v.amount, 0);

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <Header title="Vendas" subtitle="Histórico de transações com rastreamento UTM" />

        {/* Summary */}
        <div className="flex flex-wrap gap-4 mb-5 p-3 bg-card border border-border rounded-xl text-sm">
          <Stat label="Aprovadas"   value={String(approved.length)}                              color="text-accent" />
          <div className="w-px bg-border" />
          <Stat label="Faturado"    value={`R$ ${totalRev.toLocaleString("pt-BR")}`}             color="text-accent" />
          <div className="w-px bg-border" />
          <Stat label="Order Bumps" value={`${orderBumps.length} · R$ ${totalOB.toLocaleString("pt-BR")}`} color="text-gold" />
          <div className="w-px bg-border" />
          <Stat label="Reembolsos"  value={`${refunds.length} · R$ ${totalRef.toLocaleString("pt-BR")}`}   color="text-red" />
        </div>

        <DataTable<SaleRow> columns={columns} data={mockSales} rowKey="id" />
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
