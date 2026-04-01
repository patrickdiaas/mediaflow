"use client";
import { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import DataTable, { Column } from "@/components/data-table";
import { supabase } from "@/lib/supabase";
import { useDashboard } from "@/lib/dashboard-context";
import { getSalesDates } from "@/lib/period";
import type { ProductRow, Gateway } from "@/lib/types";
import { RefreshCw, Package } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ─── Badges ───────────────────────────────────────────────────────────────────
const gatewayLabel: Record<string, string> = { dmguru: "DMGuru", hotmart: "Hotmart", eduzz: "Eduzz" };
const gatewayColor: Record<string, string> = {
  dmguru:  "text-green border-green/30 bg-green/10",
  hotmart: "text-gold border-gold/30 bg-gold/10",
  eduzz:   "text-blue border-blue/30 bg-blue/10",
};

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

// ─── Helpers ──────────────────────────────────────────────────────────────────
interface TrackedProduct { product_id: string; product_name: string | null; gateway: string; }

function buildProductRows(tracked: TrackedProduct[], sales: any[]): ProductRow[] {
  return tracked.map(tp => {
    const ps       = sales.filter(s => s.product_id === tp.product_id);
    const approved = ps.filter(s => s.status === "approved");
    const refunded = ps.filter(s => s.status === "refunded" || s.status === "chargeback");
    const revenue  = approved.reduce((sum, s) => sum + Number(s.amount), 0);
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

function buildTrend(sales: any[]) {
  const map = new Map<string, { vendas: number; receita: number }>();
  for (const s of sales) {
    if (s.status !== "approved") continue;
    const day = s.created_at?.slice(0, 10) ?? "";
    if (!day) continue;
    const e = map.get(day) ?? { vendas: 0, receita: 0 };
    e.vendas++;
    e.receita += Number(s.amount);
    map.set(day, e);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date: new Date(date + "T12:00:00Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      ...v,
    }));
}

type UTMKey = "utm_medium" | "utm_source";

function buildTopUTMs(sales: any[], key: UTMKey) {
  const map = new Map<string, { vendas: number; receita: number }>();
  for (const s of sales) {
    if (s.status !== "approved") continue;
    const label = s[key] ?? (key === "utm_medium" ? "Direto" : "Orgânico");
    const e = map.get(label) ?? { vendas: 0, receita: 0 };
    e.vendas++;
    e.receita += Number(s.amount);
    map.set(label, e);
  }
  return Array.from(map.entries())
    .sort(([, a], [, b]) => b.receita - a.receita)
    .slice(0, 8)
    .map(([campaign, v]) => ({ campaign, ...v }));
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function ProdutosPage() {
  const { client, period } = useDashboard();

  const [clients,         setClients]         = useState<{ slug: string; sales_slug: string | null }[]>([]);
  const [products,        setProducts]        = useState<ProductRow[]>([]);
  const [allSales,        setAllSales]        = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [utmTab,          setUtmTab]          = useState<UTMKey>("utm_medium");
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState<string | null>(null);
  const [noTracked,       setNoTracked]       = useState(false);

  useEffect(() => {
    supabase.from("clients").select("slug, sales_slug").eq("active", true)
      .then(({ data }) => { if (data) setClients(data as { slug: string; sales_slug: string | null }[]); });
  }, []);

  function getSalesSlug(): string | null {
    if (client === "all") return null;
    const found = clients.find(c => c.slug === client);
    return found?.sales_slug ?? client;
  }

  async function fetchData() {
    setLoading(true);
    setError(null);
    setNoTracked(false);

    const { since, until } = getSalesDates(period);
    const salesSlug = getSalesSlug();

    const trackedQ = supabase.from("tracked_products").select("product_id, product_name, gateway").eq("active", true);
    const { data: tracked, error: tErr } = await (salesSlug ? trackedQ.eq("client_slug", salesSlug) : trackedQ);

    if (tErr) { setError(tErr.message); setLoading(false); return; }
    if (!tracked?.length) { setNoTracked(true); setProducts([]); setAllSales([]); setLoading(false); return; }

    const ids = tracked.map(p => p.product_id);

    const salesQ = supabase
      .from("sales")
      .select("id, created_at, gateway, sale_type, amount, status, product_name, product_id, utm_medium, utm_campaign, utm_content, utm_source")
      .in("product_id", ids)
      .gte("created_at", since)
      .lte("created_at", until)
      .order("created_at", { ascending: true });
    if (salesSlug) salesQ.eq("client_slug", salesSlug);

    const { data: rawSales, error: sErr } = await salesQ;

    if (sErr) { setError(sErr.message); setLoading(false); return; }

    setProducts(buildProductRows(tracked, rawSales ?? []));
    setAllSales(rawSales ?? []);
    setSelectedProduct("all");
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [client, period, clients]);

  const filteredSales = selectedProduct === "all"
    ? allSales
    : allSales.filter(s => s.product_id === selectedProduct);

  const approved   = allSales.filter(s => s.status === "approved");
  const refunds    = allSales.filter(s => s.status === "refunded" || s.status === "chargeback");
  const orderBumps = approved.filter(s => s.sale_type === "order_bump");
  const revenue    = approved.filter(s => s.sale_type === "main").reduce((s, v) => s + Number(v.amount), 0);
  const obRevenue  = orderBumps.reduce((s, v) => s + Number(v.amount), 0);
  const refRevenue = refunds.reduce((s, v) => s + Number(v.amount), 0);

  const trendData = buildTrend(filteredSales);
  const utmData   = buildTopUTMs(filteredSales, utmTab);
  const maxUTM    = Math.max(...utmData.map(u => u.receita), 1);

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="flex items-start justify-between mb-4">
          <Header title="Produtos" subtitle="Performance por produto e análise de atribuição" />
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
          <Stat label="Receita"      value={loading ? "…" : `R$ ${fmt(revenue)}`}                                         color="text-accent" />
          <div className="w-px bg-border" />
          <Stat label="Vendas"       value={loading ? "…" : String(approved.filter(s => s.sale_type === "main").length)}  color="text-green"  />
          <div className="w-px bg-border" />
          <Stat label="Order Bumps"  value={loading ? "…" : `${orderBumps.length} · R$ ${fmt(obRevenue)}`}               color="text-gold"   />
          <div className="w-px bg-border" />
          <Stat label="Reembolsos"   value={loading ? "…" : `${refunds.length} · R$ ${fmt(refRevenue)}`}                 color="text-red"    />
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

            {/* Seletor de produto para análise */}
            <div className="flex items-center gap-3 mt-6 mb-4">
              <span className="text-sm font-semibold text-text-primary">Análise por produto</span>
              <select
                value={selectedProduct}
                onChange={e => setSelectedProduct(e.target.value)}
                className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent/40 cursor-pointer"
              >
                <option value="all">Todos os produtos</option>
                {products.map(p => (
                  <option key={p.product_id} value={p.product_id}>{p.product_name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Tendência diária */}
              <div className="bg-card border border-border rounded-xl p-5">
                <span className="text-sm font-semibold text-text-primary block mb-4">Vendas por dia</span>
                {trendData.length === 0 ? (
                  <p className="text-text-muted text-xs py-8 text-center">Sem dados no período.</p>
                ) : (
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload;
                            return (
                              <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
                                <p className="text-text-secondary mb-1">{d.date}</p>
                                <p className="text-text-primary">Vendas: <span className="text-accent font-mono">{d.vendas}</span></p>
                                <p className="text-text-primary">Receita: <span className="text-accent font-mono">R$ {fmt(d.receita)}</span></p>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="vendas" radius={[3, 3, 0, 0]}>
                          {trendData.map((_, i) => (
                            <Cell key={i} fill="#CAFF04" opacity={0.7} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Top campanhas / origem */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-text-primary">Atribuição</span>
                  <div className="flex rounded-lg overflow-hidden border border-border text-[11px] font-medium">
                    {([["utm_medium", "Campanhas"], ["utm_source", "Origem"]] as [UTMKey, string][]).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setUtmTab(key)}
                        className={`px-3 py-1 transition-colors ${
                          utmTab === key
                            ? "bg-accent/10 text-accent"
                            : "text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {utmData.length === 0 ? (
                  <p className="text-text-muted text-xs py-8 text-center">Sem dados no período.</p>
                ) : (
                  <div className="space-y-3">
                    {utmData.map((u, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-text-primary truncate max-w-[200px]" title={u.campaign}>{u.campaign}</span>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-xs font-mono text-text-secondary">{u.vendas}v</span>
                            <span className="text-xs font-mono text-accent">R$ {fmt(u.receita)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent/60"
                            style={{ width: `${(u.receita / maxUTM) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

