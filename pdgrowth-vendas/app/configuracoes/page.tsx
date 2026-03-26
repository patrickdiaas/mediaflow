"use client";
import { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { supabase } from "@/lib/supabase";
import { useDashboard } from "@/lib/dashboard-context";
import { RefreshCw, Package } from "lucide-react";

interface TrackedProduct {
  id: string;
  client_slug: string;
  gateway: string;
  product_id: string;
  product_name: string | null;
  active: boolean;
  first_seen: string;
}

const gatewayColor: Record<string, string> = {
  dmguru:  "text-green border-green/30 bg-green/10",
  hotmart: "text-gold border-gold/30 bg-gold/10",
  eduzz:   "text-blue border-blue/30 bg-blue/10",
};

const gatewayLabel: Record<string, string> = {
  dmguru: "DMGuru", hotmart: "Hotmart", eduzz: "Eduzz",
};

export default function ConfiguracoesPage() {
  const { client } = useDashboard();
  const [products, setProducts] = useState<TrackedProduct[]>([]);
  const [loading, setLoading]   = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  async function fetchProducts() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("tracked_products")
      .select("*")
      .eq("client_slug", client)
      .order("first_seen", { ascending: false });

    if (error) {
      setError("Erro ao carregar produtos: " + error.message);
    } else {
      setProducts(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { fetchProducts(); }, [client]);

  async function toggleProduct(product: TrackedProduct) {
    setToggling(product.id);
    const res = await fetch(`/api/products/${product.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ active: !product.active }),
    });

    if (res.ok) {
      setProducts(prev =>
        prev.map(p => p.id === product.id ? { ...p, active: !p.active } : p)
      );
    } else {
      setError("Erro ao atualizar produto.");
    }
    setToggling(null);
  }

  const active   = products.filter(p => p.active);
  const inactive = products.filter(p => !p.active);

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <Header title="Configurações" subtitle="Gerencie quais produtos aparecem no dashboard" />

        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-4 text-sm">
            <span className="text-text-muted">
              <span className="font-mono font-semibold text-accent">{active.length}</span> rastreados
            </span>
            <span className="text-text-muted">
              <span className="font-mono font-semibold text-text-secondary">{inactive.length}</span> inativos
            </span>
          </div>
          <button
            onClick={fetchProducts}
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red/10 border border-red/30 rounded-lg text-red text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-text-muted text-sm">
            <RefreshCw size={16} className="animate-spin mr-2" /> Carregando produtos...
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <Package size={32} className="text-text-dark" />
            <p className="text-text-secondary text-sm">Nenhum produto encontrado ainda.</p>
            <p className="text-text-muted text-xs max-w-xs">
              Os produtos aparecerão aqui automaticamente após a primeira venda ser recebida pelo webhook.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Produtos rastreados */}
            {active.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-3">
                  Rastreados no dashboard
                </h2>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  {active.map((p, i) => (
                    <ProductRow
                      key={p.id}
                      product={p}
                      last={i === active.length - 1}
                      toggling={toggling === p.id}
                      onToggle={() => toggleProduct(p)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Produtos inativos */}
            {inactive.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-3">
                  Não rastreados
                </h2>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  {inactive.map((p, i) => (
                    <ProductRow
                      key={p.id}
                      product={p}
                      last={i === inactive.length - 1}
                      toggling={toggling === p.id}
                      onToggle={() => toggleProduct(p)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function ProductRow({ product, last, toggling, onToggle }: {
  product: TrackedProduct;
  last: boolean;
  toggling: boolean;
  onToggle: () => void;
}) {
  const firstSeen = new Date(product.first_seen).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
  });

  return (
    <div className={`flex items-center justify-between px-5 py-4 ${!last ? "border-b border-border" : ""}`}>
      <div className="flex items-center gap-3">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${gatewayColor[product.gateway] ?? "text-text-muted border-border"}`}>
          {gatewayLabel[product.gateway] ?? product.gateway}
        </span>
        <div>
          <div className="text-sm text-text-primary font-medium">
            {product.product_name ?? "Produto sem nome"}
          </div>
          <div className="text-xs text-text-muted font-mono mt-0.5">
            ID: {product.product_id} · Primeira venda: {firstSeen}
          </div>
        </div>
      </div>

      {/* Toggle */}
      <button
        onClick={onToggle}
        disabled={toggling}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
          product.active ? "bg-accent" : "bg-border"
        } ${toggling ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
            product.active ? "translate-x-5" : "translate-x-0"
          }`}
          style={{ backgroundColor: product.active ? "#0A0A0C" : "#F2F2F5" }}
        />
      </button>
    </div>
  );
}
