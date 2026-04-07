"use client";
import { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { supabase } from "@/lib/supabase";
import { useDashboard } from "@/lib/dashboard-context";
import { RefreshCw, Package, FileSpreadsheet, Check } from "lucide-react";

interface TrackedProduct {
  id: string;
  client_slug: string;
  gateway: string;
  product_id: string;
  product_name: string | null;
  active: boolean;
  sheet_id: string | null;
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
  const [clients, setClients] = useState<{ slug: string; sales_slug: string | null }[]>([]);
  const [products, setProducts]   = useState<TrackedProduct[]>([]);
  const [loading, setLoading]     = useState(true);
  const [toggling, setToggling]   = useState<string | null>(null);
  const [savingSheet, setSavingSheet] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    supabase.from("clients").select("slug, sales_slug").eq("active", true)
      .then(({ data }) => { if (data) setClients(data); });
  }, []);

  function getSalesSlug(): string | null {
    if (client === "all") return null;
    const found = clients.find(c => c.slug === client);
    return found?.sales_slug ?? client;
  }

  async function fetchProducts() {
    setLoading(true);
    setError(null);
    const salesSlug = getSalesSlug();
    const q = supabase.from("tracked_products").select("*").order("first_seen", { ascending: false });
    const { data, error } = await (salesSlug ? q.eq("client_slug", salesSlug) : q);

    if (error) {
      setError("Erro ao carregar produtos: " + error.message);
    } else {
      setProducts(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { fetchProducts(); }, [client, clients]);

  async function saveSheetId(product: TrackedProduct, sheetId: string) {
    setSavingSheet(product.id);
    const res = await fetch(`/api/products/${product.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ sheet_id: sheetId.trim() || null }),
    });
    if (res.ok) {
      setProducts(prev =>
        prev.map(p => p.id === product.id ? { ...p, sheet_id: sheetId.trim() || null } : p)
      );
    } else {
      setError("Erro ao salvar planilha.");
    }
    setSavingSheet(null);
  }

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
    <div className="flex h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-h-0 p-4 md:p-6 overflow-y-auto">
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
                      savingSheet={savingSheet === p.id}
                      onToggle={() => toggleProduct(p)}
                      onSaveSheet={(id) => saveSheetId(p, id)}
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
                      savingSheet={savingSheet === p.id}
                      onToggle={() => toggleProduct(p)}
                      onSaveSheet={(id) => saveSheetId(p, id)}
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

function ProductRow({ product, last, toggling, savingSheet, onToggle, onSaveSheet }: {
  product: TrackedProduct;
  last: boolean;
  toggling: boolean;
  savingSheet: boolean;
  onToggle: () => void;
  onSaveSheet: (id: string) => void;
}) {
  const [sheetInput, setSheetInput] = useState(product.sheet_id ?? "");
  const [saved, setSaved] = useState(false);

  const firstSeen = new Date(product.first_seen).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
  });

  async function handleSave() {
    await onSaveSheet(sheetInput);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className={`px-5 py-4 ${!last ? "border-b border-border" : ""}`}>
      <div className="flex items-center justify-between">
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

        <button
          onClick={onToggle}
          disabled={toggling}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
            product.active ? "bg-accent" : "bg-border"
          } ${toggling ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow transition-transform duration-200 ${
              product.active ? "translate-x-5" : "translate-x-0"
            }`}
            style={{ backgroundColor: product.active ? "#0A0A0C" : "#F2F2F5" }}
          />
        </button>
      </div>

      {/* Sheet ID input */}
      <div className="mt-3 flex items-center gap-2">
        <FileSpreadsheet size={13} className="text-text-muted flex-shrink-0" />
        <input
          type="text"
          value={sheetInput}
          onChange={e => setSheetInput(e.target.value)}
          placeholder="ID da planilha Google (ex: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms)"
          className="flex-1 bg-bg border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary font-mono placeholder:text-text-dark focus:outline-none focus:border-accent/40"
        />
        <button
          onClick={handleSave}
          disabled={savingSheet}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-card border border-border text-text-secondary hover:text-accent hover:border-accent/30 transition-colors disabled:opacity-50"
        >
          {saved ? <Check size={12} className="text-accent" /> : <FileSpreadsheet size={12} />}
          {saved ? "Salvo!" : "Salvar"}
        </button>
      </div>
    </div>
  );
}
