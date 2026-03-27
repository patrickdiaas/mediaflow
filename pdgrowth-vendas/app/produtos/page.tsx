"use client";
import { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import DataTable, { Column } from "@/components/data-table";
import { supabase } from "@/lib/supabase";
import { useDashboard } from "@/lib/dashboard-context";
import { getPeriodDates } from "@/lib/period";
import type { ProductRow, SaleRow, Gateway, SaleStatus, SaleType } from "@/lib/types";
import { RefreshCw, Package } from "lucide-react";

// ─── Badges ───────────────────────────────────────────────────────────────────
const gatewayLabel: Record<string, string> = { dmguru: "DMGuru", hotmart: "Hotmart", eduzz: "Eduzz" };
const gatewayColor: Record<string, string> = {
  dmguru:  "text-green border-green/30 bg-green/10",
  hotmart: "text-gold border-gold/30 bg-gold/10",
  eduzz:   "text-blue border-blue/30 bg-blue/10",
};
const statusLabel: Record<SaleStatus, string> = {
  approved: "Aprovado", refunded: "Reembolso", chargeback: "Chargeback",
  pending: "Pendente", cancelled: "Cancelado",
};
const statusColor: Record<SaleStatus, string> = {
  approved:   "text-accent border-accent/30 bg-accent-dim",
  refunded:   "text-red border-red/30 bg-red/10",
  chargeback: "text-red border-red/30 bg-red-dim",
  pending:    "text-gold border-gold/30 bg-gold/10",
  cancelled:  "text-text-muted border-border bg-bg",
};
const saleTypeLabel: Record<SaleType, string> = {
  main: "Principal", order_bump: "Order Bump", upsell: "Upsell",
};
const saleTypeColor: Record<SaleType, string> = {
  main:       "text-text-secondary border-border bg-bg",
  order_bump: "text-gold border-gold/30 bg-gold/10",
  upsell:     "text-blue border-blue/30 bg-blue/10",
};
const paymentLabel: Record<string, string> = {
  credit_card: "Cartão", pix: "PIX", boleto: "Boleto",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Colunas ──────────────────────────────────────────────────────────────────
const productColumns: Column<ProductRow>[] = [
  {
    key: "product_name",
    label: "Produto",
    render: (v, row) => (
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${gatewayColor[row.gateway]}`}>
          {gatewayLabel[row.gateway]}
        </span>
        {row.is_order_bump && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border text-gold border-gold/30 bg-gold/10">
            Order Bump
          </span>
        )}
        <span className="text-text-primary text-sm">{String(v)}</span>
      </div>
    ),
  },
  { key: "sales",       label: "Vendas",        align: "right",
    render: v => <span className="text-green font-semibold">{String(v)}</span> },
  { key: "revenue",     label: "Receita",       align: "right",
    render: v => <span className="text-accent">R$ {fmt(Number(v))}</span> },
  { key: "avg_ticket",  label: "Ticket Médio",  align: "right",
    render: v => <span className="text-gold">R$ {fmt(Number(v))}</span> },
  { key: "refunds",     label: "Reembolsos",    align: "right",
    render: v => <span className="text-red">{String(v)}</span> },
  { key: "refund_rate", label: "Taxa Reembolso", align: "right",
    render: v => {
      const n = Number(v);
      return <span className={n > 5 ? "text-red" : n > 3 ? "text-gold" : "text-accent"}>{n.toFixed(2)}%</span>;
    }},
];

const saleColumns: Column<SaleRow>[] = [
  { key: "created_at",     label: "Data",
    render: v => <span className="text-text-secondary text-xs font-mono">{formatDate(String(v))}</span> },
  { key: "gateway",        label: "Gateway",
    render: v => {
      const g = String(v);
      return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${gatewayColor[g] ?? ""}`}>{gatewayLabel[g] ?? g}</span>;
    }},
  { key: "sale_type",      label: "Tipo",
    render: v => {
      const t = v as SaleType;
      return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${saleTypeColor[t]}`}>{saleTypeLabel[t]}</span>;
    }},
  { key: "product_name",   label: "Produto",
    render: v => <span className="text-text-secondary text-xs truncate max-w-[180px] block" title={String(v ?? "")}>{String(v ?? "—")}</span> },
  { key: "amount",         label: "Valor",  align: "right",
    render: v => <span className="text-accent font-mono">R$ {fmt(Number(v))}</span> },
  { key: "status",         label: "Status", align: "center",
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
interface TrackedProduct { product_id: string; product_name: string | null; gateway: string; }

function buildProductRows(tracked: TrackedProduct[], sales: any[]): ProductRow[] {
  return tracked.map(tp => {
    const ps       = sales.filter(s => s.product_id === tp.product_id);
    const approved = ps.filter(s => s.status === "approved");
    const refunded = ps.filter(s => s.status === "refunded" || s.status === "chargeback");
    const revenue  = approved.reduce((sum, s) => sum + Number(s.amount), 0);
    const refundAmt = refunded.reduce((sum, s) => sum + Number(s.amount), 0);
    void refundAmt;
    return {
      product_id:    tp.product_id,
      product_name:  tp.product_name ?? "Produto sem nome",
      gateway:       tp.gateway as Gateway,
      sales:         approved.length,
      revenue,
      avg_ticket:    approved.length > 0 ? revenue / approved.length : 0,
      refunds:       refunded.length,
      refund_rate:   (approved.length + refunded.length) > 0
        ? (refunded.length / (approved.length + refunded.length)) * 100 : 0,
      is_order_bump: ps.length > 0 && ps.every(s => s.sale_type === "order_bump"),
    };
  });
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function ProdutosPage() {
  const { client, period } = useDashboard();

  const [products,  setProducts]  = useState<ProductRow[]>([]);
  const [sales,     setSales]     = useState<SaleRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [noTracked, setNoTracked] = useState(false);

  async function fetchData() {
    setLoading(true);
    setError(null);
    setNoTracked(false);

    const { from, to } = getPeriodDates(period);

    // 1. Produtos rastreados ativos
    const { data: tracked, error: tErr } = await supabase
      .from("tracked_products")
      .select("product_id, product_name, gateway")
      .eq("client_slug", client)
      .eq("active", true);

    if (tErr) { setError(tErr.message); setLoading(false); return; }
    if (!tracked?.length) { setNoTracked(true); setProducts([]); setSales([]); setLoading(false); return; }

    const ids = tracked.map(p => p.product_id);

    // 2. Vendas para esses produtos no período
    const { data: rawSales, error: sErr } = await supabase
      .from("sales")
      .select("id, created_at, gateway, sale_type, amount, status, product_name, utm_medium, utm_campaign, utm_content, utm_source, utm_term, payment_method, product_id")
      .eq("client_slug", client)
      .in("product_id", ids)
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: false });

    if (sErr) { setError(sErr.message); setLoading(false); return; }

    setProducts(buildProductRows(tracked, rawSales ?? []));
    setSales((rawSales ?? []) as SaleRow[]);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [client, period]);

  // Resumo
  const approved   = sales.filter(s => s.status === "approved");
  const refunds    = sales.filter(s => s.status === "refunded" || s.status === "chargeback");
  const orderBumps = approved.filter(s => s.sale_type === "order_bump");
  const revenue    = approved.filter(s => s.sale_type === "main").reduce((s, v) => s + Number(v.amount), 0);
  const obRevenue  = orderBumps.reduce((s, v) => s + Number(v.amount), 0);
  const refRevenue = refunds.reduce((s, v) => s + Number(v.amount), 0);

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="flex items-start justify-between mb-4">
          <Header title="Produtos" subtitle="Performance por produto e histórico de transações" />
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors mt-1"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>

        {/* Summary */}
        <div className="flex flex-wrap gap-4 mb-5 p-3 bg-card border border-border rounded-xl text-sm">
          <Stat label="Receita"      value={loading ? "…" : `R$ ${fmt(revenue)}`}                                       color="text-accent" />
          <div className="w-px bg-border" />
          <Stat label="Vendas"       value={loading ? "…" : String(approved.filter(s => s.sale_type === "main").length)} color="text-green"  />
          <div className="w-px bg-border" />
          <Stat label="Order Bumps"  value={loading ? "…" : `${orderBumps.length} · R$ ${fmt(obRevenue)}`}              color="text-gold"   />
          <div className="w-px bg-border" />
          <Stat label="Reembolsos"   value={loading ? "…" : `${refunds.length} · R$ ${fmt(refRevenue)}`}                color="text-red"    />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red/10 border border-red/30 rounded-lg text-red text-sm">{error}</div>
        )}

        {noTracked ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <Package size={32} className="text-text-dark" />
            <p className="text-text-secondary text-sm">Nenhum produto rastreado ainda.</p>
            <p className="text-text-muted text-xs max-w-xs">
              Ative os produtos em <strong className="text-text-secondary">Configurações</strong> para que eles apareçam aqui.
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20 text-text-muted text-sm gap-2">
            <RefreshCw size={15} className="animate-spin" /> Carregando...
          </div>
        ) : (
          <>
            <DataTable<ProductRow> columns={productColumns} data={products} rowKey="product_id" />
            <div className="mt-6">
              <span className="text-sm font-semibold text-text-primary block mb-3">
                Transações
                <span className="text-text-muted font-normal text-xs ml-2">({sales.length} registros)</span>
              </span>
              <DataTable<SaleRow> columns={saleColumns} data={sales} rowKey="id" />
            </div>
          </>
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
