"use client";
import { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import DataTable, { Column } from "@/components/data-table";
import { useDashboard } from "@/lib/dashboard-context";
import { supabase } from "@/lib/supabase";
import { getSalesDates } from "@/lib/period";
import { RefreshCw } from "lucide-react";
import type { SaleRow } from "@/lib/types";

const gatewayLabel: Record<string, string> = { dmguru: "DMGuru", hotmart: "Hotmart", eduzz: "Eduzz" };
const gatewayColor: Record<string, string> = {
  dmguru:  "text-green border-green/30 bg-green/10",
  hotmart: "text-gold border-gold/30 bg-gold/10",
  eduzz:   "text-blue border-blue/30 bg-blue/10",
};

const statusLabel: Record<string, string> = {
  approved:   "Aprovado",
  refunded:   "Reembolso",
  chargeback: "Chargeback",
  pending:    "Pendente",
  cancelled:  "Cancelado",
};

const statusColor: Record<string, string> = {
  approved:   "text-accent border-accent/30 bg-accent-dim",
  refunded:   "text-red border-red/30 bg-red/10",
  chargeback: "text-red border-red/30 bg-red-dim",
  pending:    "text-gold border-gold/30 bg-gold/10",
  cancelled:  "text-text-muted border-border bg-bg",
};

const saleTypeLabel: Record<string, string> = {
  main:       "Principal",
  order_bump: "Order Bump",
  upsell:     "Upsell",
};

const saleTypeColor: Record<string, string> = {
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
      const g = String(v);
      return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${gatewayColor[g] ?? "text-text-muted border-border"}`}>{gatewayLabel[g] ?? g}</span>;
    },
  },
  {
    key: "sale_type",
    label: "Tipo",
    render: v => {
      const t = String(v);
      return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${saleTypeColor[t] ?? "text-text-muted border-border"}`}>{saleTypeLabel[t] ?? t}</span>;
    },
  },
  {
    key: "amount",
    label: "Valor",
    align: "right",
    render: v => <span className="text-accent font-mono">R$ {Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>,
  },
  {
    key: "status",
    label: "Status",
    align: "center",
    render: v => {
      const s = String(v);
      return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${statusColor[s] ?? "text-text-muted border-border"}`}>{statusLabel[s] ?? s}</span>;
    },
  },
  {
    key: "utm_medium",
    label: "Campanha",
    render: v => <span className="text-text-muted text-xs truncate max-w-[160px] block" title={String(v ?? "")}>{String(v ?? "—")}</span>,
  },
  {
    key: "utm_campaign",
    label: "Conjunto",
    render: v => <span className="text-text-muted text-xs truncate max-w-[160px] block" title={String(v ?? "")}>{String(v ?? "—")}</span>,
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
  const { client, period } = useDashboard();
  const [sales,   setSales]   = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<{ slug: string; sales_slug: string | null }[]>([]);

  useEffect(() => {
    supabase.from("clients").select("slug, sales_slug").eq("active", true)
      .then(({ data }) => { if (data) setClients(data); });
  }, []);

  useEffect(() => {
    const { since, until } = getSalesDates(period);
    const salesSlug = client === "all" ? null : (clients.find(c => c.slug === client)?.sales_slug ?? client);

    setLoading(true);
    const q = supabase
      .from("sales")
      .select("id, created_at, gateway, sale_type, amount, status, product_name, utm_source, utm_medium, utm_campaign, utm_content, utm_term, payment_method")
      .gte("created_at", since)
      .lte("created_at", until)
      .order("created_at", { ascending: false });

    (salesSlug ? q.eq("client_slug", salesSlug) : q).then(({ data }) => {
      setSales((data ?? []) as SaleRow[]);
      setLoading(false);
    });
  }, [client, period, clients]);

  const approved   = sales.filter(s => s.status === "approved");
  const refunds    = sales.filter(s => s.status === "refunded" || s.status === "chargeback");
  const orderBumps = sales.filter(s => s.sale_type === "order_bump" && s.status === "approved");
  const totalRev   = approved.filter(s => s.sale_type === "main").reduce((s, v) => s + Number(v.amount), 0);
  const totalRef   = refunds.reduce((s, v) => s + Number(v.amount), 0);
  const totalOB    = orderBumps.reduce((s, v) => s + Number(v.amount), 0);

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 p-4 md:p-6 overflow-y-auto">
        <Header title="Vendas" subtitle="Histórico de transações com rastreamento UTM" />

        <div className="flex flex-wrap gap-4 mb-5 p-3 bg-card border border-border rounded-xl text-sm">
          <Stat label="Aprovadas"   value={String(approved.length)}                                                    color="text-accent" />
          <div className="w-px bg-border" />
          <Stat label="Faturado"    value={`R$ ${totalRev.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}     color="text-accent" />
          <div className="w-px bg-border" />
          <Stat label="Order Bumps" value={`${orderBumps.length} · R$ ${totalOB.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} color="text-gold" />
          <div className="w-px bg-border" />
          <Stat label="Reembolsos"  value={`${refunds.length} · R$ ${totalRef.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}   color="text-red" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-text-muted text-sm gap-2">
            <RefreshCw size={15} className="animate-spin" /> Carregando...
          </div>
        ) : sales.length === 0 ? (
          <p className="text-text-muted text-sm py-16 text-center">Nenhuma venda encontrada no período.</p>
        ) : (
          <DataTable<SaleRow> columns={columns} data={sales} rowKey="id" />
        )}
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
