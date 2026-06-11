"use client";
import { Shell } from "@/components/shell";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

type Client = { id: string; name: string };
type Variant = { name: string; destination_url: string; weight: number };

export default function NewFunnelPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [clientId, setClientId] = useState("");
  const [variants, setVariants] = useState<Variant[]>([
    { name: "A", destination_url: "", weight: 50 },
    { name: "B", destination_url: "", weight: 50 },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/clients").then(r => r.json()).then(j => {
      setClients(j.clients ?? []);
      if (j.clients?.[0]) setClientId(j.clients[0].id);
    });
  }, []);

  function updateVariant(i: number, patch: Partial<Variant>) {
    setVariants(v => v.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  }
  function addVariant() {
    const letter = String.fromCharCode(65 + variants.length);
    setVariants(v => [...v, { name: letter, destination_url: "", weight: 0 }]);
  }
  function removeVariant(i: number) {
    setVariants(v => v.filter((_, idx) => idx !== i));
  }

  async function submit() {
    setError(null);
    if (!name || !clientId) { setError("Nome e cliente são obrigatórios."); return; }
    const ok = variants.filter(v => v.destination_url.trim());
    if (ok.length === 0) { setError("Adicione pelo menos uma variante com URL."); return; }
    if (ok.reduce((s, v) => s + v.weight, 0) === 0) { setError("Pesos somam zero."); return; }

    setSaving(true);
    const r = await fetch("/api/funnels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, slug, client_id: clientId, variants: ok }),
    });
    const j = await r.json();
    setSaving(false);
    if (!r.ok) { setError(j.error ?? "Erro"); return; }
    router.push(`/funnels/${j.funnel.slug}`);
  }

  return (
    <Shell title="Novo funil">
      <div className="bg-card border border-border rounded-xl p-6 space-y-5 max-w-3xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-text-secondary text-xs font-mono uppercase tracking-wider block mb-1.5">Nome</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: Lançamento Produto X"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/40" />
          </div>
          <div>
            <label className="text-text-secondary text-xs font-mono uppercase tracking-wider block mb-1.5">Cliente</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/40">
              {clients.length === 0 && <option value="">— sem clientes, cadastre em /clients —</option>}
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-text-secondary text-xs font-mono uppercase tracking-wider block mb-1.5">Slug público (opcional)</label>
          <input value={slug} onChange={e => setSlug(e.target.value)}
            placeholder="auto-gerado pelo nome"
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary font-mono focus:outline-none focus:border-accent/40" />
          <p className="text-text-muted text-xs mt-1.5">Link público: <span className="font-mono">/f/{slug || "(auto)"}</span></p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-text-secondary text-xs font-mono uppercase tracking-wider">Variantes da página de vendas</label>
            <button onClick={addVariant} className="text-xs text-accent hover:underline inline-flex items-center gap-1">
              <Plus size={12} /> Adicionar variante
            </button>
          </div>
          <div className="space-y-2">
            {variants.map((v, i) => (
              <div key={i} className="grid grid-cols-[60px_1fr_90px_32px] gap-2 items-center">
                <input value={v.name} onChange={e => updateVariant(i, { name: e.target.value })}
                  className="bg-bg border border-border rounded-lg px-2 py-2 text-sm text-text-primary text-center font-mono focus:outline-none focus:border-accent/40" />
                <input value={v.destination_url} onChange={e => updateVariant(i, { destination_url: e.target.value })}
                  placeholder="https://página-de-vendas.com"
                  className="bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/40" />
                <div className="relative">
                  <input type="number" min={0} max={100} value={v.weight}
                    onChange={e => updateVariant(i, { weight: Number(e.target.value) })}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary pr-7 focus:outline-none focus:border-accent/40" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">%</span>
                </div>
                <button onClick={() => removeVariant(i)} disabled={variants.length === 1}
                  className="text-text-muted hover:text-red transition-colors disabled:opacity-30">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <p className="text-text-muted text-xs mt-2">
            Os pesos são proporcionais — não precisam somar 100. Variantes com peso 0 ficam pausadas.
          </p>
        </div>

        {error && <div className="text-red text-sm">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={() => router.back()}
            className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary">Cancelar</button>
          <button onClick={submit} disabled={saving}
            className="bg-accent text-bg px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent/90 disabled:opacity-50">
            {saving ? "Criando..." : "Criar funil"}
          </button>
        </div>
      </div>
    </Shell>
  );
}
