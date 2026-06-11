"use client";
import { Shell } from "@/components/shell";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

type Client = { id: string; name: string; slug: string; created_at: string };

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const r = await fetch("/api/clients");
    const j = await r.json();
    setClients(j.clients ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return;
    setLoading(true);
    await fetch("/api/clients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    await load();
    setLoading(false);
  }

  return (
    <Shell title="Clientes">
      <div className="bg-card border border-border rounded-xl p-4 mb-6 flex gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nome do cliente"
          className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/40"
          onKeyDown={e => e.key === "Enter" && create()}
        />
        <button onClick={create} disabled={loading || !name.trim()}
          className="inline-flex items-center gap-1.5 bg-accent text-bg px-3 py-2 rounded-lg text-sm font-semibold hover:bg-accent/90 disabled:opacity-50">
          <Plus size={14} /> Adicionar
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-muted text-xs uppercase tracking-wider border-b border-border">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Criado em</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-text-muted text-sm">Nenhum cliente ainda.</td></tr>
            )}
            {clients.map(c => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-text-primary">{c.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-text-secondary">{c.slug}</td>
                <td className="px-4 py-3 text-text-secondary text-xs">{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
