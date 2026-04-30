"use client";
import { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { supabase } from "@/lib/supabase";
import { useDashboard } from "@/lib/dashboard-context";
import { RefreshCw, FileText, FileSpreadsheet, Check, Link2, Plus, Trash2 } from "lucide-react";

interface CampaignAliasRow {
  id: string;
  client_slug: string;
  alias_utm_campaign: string;
  target_campaign_name: string;
  notes: string | null;
  created_at: string;
}

interface TrackedForm {
  id: string;
  client_slug: string;
  source: string;
  conversion_event: string;
  display_name: string | null;
  active: boolean;
  sheet_id: string | null;
  first_seen: string;
}

const sourceColor: Record<string, string> = {
  rdstation:      "text-accent border-accent/30 bg-accent/10",
  meta_leadform:  "text-blue border-blue/30 bg-blue/10",
  manual:         "text-gold border-gold/30 bg-gold/10",
};

const sourceLabel: Record<string, string> = {
  rdstation: "RD Station", meta_leadform: "Meta Lead Form", manual: "Manual",
};

export default function ConfiguracoesPage() {
  const { client } = useDashboard();
  const [forms, setForms]           = useState<TrackedForm[]>([]);
  const [loading, setLoading]       = useState(true);
  const [toggling, setToggling]     = useState<string | null>(null);
  const [savingSheet, setSavingSheet] = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);

  // Aliases
  const [aliases, setAliases] = useState<CampaignAliasRow[]>([]);
  const [aliasesLoading, setAliasesLoading] = useState(true);
  const [adCampaignNames, setAdCampaignNames] = useState<string[]>([]);
  const [newAliasUtm, setNewAliasUtm] = useState("");
  const [newAliasTarget, setNewAliasTarget] = useState("");
  const [newAliasNotes, setNewAliasNotes] = useState("");
  const [savingAlias, setSavingAlias] = useState(false);

  async function fetchForms() {
    setLoading(true);
    setError(null);
    const q = supabase.from("tracked_forms").select("*").order("first_seen", { ascending: false });
    const { data, error } = await (client !== "all" ? q.eq("client_slug", client) : q);

    if (error) {
      setError("Erro ao carregar formulários: " + error.message);
    } else {
      setForms(data ?? []);
    }
    setLoading(false);
  }

  async function fetchAliases() {
    setAliasesLoading(true);
    const url = client === "all" ? "/api/admin/aliases" : `/api/admin/aliases?client=${encodeURIComponent(client)}`;
    const res = await fetch(url);
    const json = await res.json();
    if (res.ok) setAliases(json.data ?? []);
    setAliasesLoading(false);
  }

  async function fetchCampaignNames() {
    if (client === "all") { setAdCampaignNames([]); return; }
    const since = new Date(); since.setDate(since.getDate() - 90);
    const { data } = await supabase
      .from("ad_campaigns")
      .select("campaign_name")
      .eq("client_slug", client)
      .gte("date", since.toISOString().slice(0, 10));
    const names = Array.from(new Set((data ?? []).map((c: any) => c.campaign_name).filter(Boolean))).sort() as string[];
    setAdCampaignNames(names);
  }

  async function addAlias() {
    if (!newAliasUtm.trim() || !newAliasTarget.trim() || client === "all") return;
    setSavingAlias(true);
    setError(null);
    const res = await fetch("/api/admin/aliases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_slug: client,
        alias_utm_campaign: newAliasUtm.trim(),
        target_campaign_name: newAliasTarget.trim(),
        notes: newAliasNotes.trim() || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) setError("Erro ao salvar alias: " + (json.error ?? "desconhecido"));
    else {
      setNewAliasUtm(""); setNewAliasTarget(""); setNewAliasNotes("");
      fetchAliases();
    }
    setSavingAlias(false);
  }

  async function deleteAlias(id: string) {
    if (!confirm("Remover este alias?")) return;
    const res = await fetch(`/api/admin/aliases?id=${id}`, { method: "DELETE" });
    if (res.ok) fetchAliases();
  }

  useEffect(() => { fetchForms(); fetchAliases(); fetchCampaignNames(); }, [client]);

  async function saveSheetId(form: TrackedForm, sheetId: string) {
    setSavingSheet(form.id);
    const res = await fetch(`/api/forms/${form.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ sheet_id: sheetId.trim() || null }),
    });
    if (res.ok) {
      setForms(prev =>
        prev.map(f => f.id === form.id ? { ...f, sheet_id: sheetId.trim() || null } : f)
      );
    } else {
      setError("Erro ao salvar planilha.");
    }
    setSavingSheet(null);
  }

  async function toggleForm(form: TrackedForm) {
    setToggling(form.id);
    const res = await fetch(`/api/forms/${form.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ active: !form.active }),
    });

    if (res.ok) {
      setForms(prev =>
        prev.map(f => f.id === form.id ? { ...f, active: !f.active } : f)
      );
    } else {
      setError("Erro ao atualizar formulário.");
    }
    setToggling(null);
  }

  const active   = forms.filter(f => f.active);
  const inactive = forms.filter(f => !f.active);

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-h-0 p-4 md:p-6 overflow-y-auto">
        <Header title="Configurações" subtitle="Gerencie formulários e atribuição de leads a campanhas" />

        {/* ─── Aliases de campanha ─── */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Link2 size={14} className="text-accent" />
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-widest">Aliases de Campanha</h2>
          </div>
          <p className="text-xs text-text-muted mb-3 leading-relaxed">
            Mapeie utm_campaign antigas ou divergentes para a campanha real. Exemplo: <span className="font-mono text-text-secondary">Search_MPT</span> → <span className="font-mono text-text-secondary">medical-search-mpt</span>. Resolve leads órfãos de uma vez.
          </p>

          {client === "all" ? (
            <div className="bg-card border border-border rounded-xl p-4 text-xs text-text-muted">
              Selecione um cliente específico no topo para gerenciar aliases.
            </div>
          ) : (
            <>
              {/* Form para adicionar */}
              <div className="bg-card border border-border rounded-xl p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                  <input
                    type="text"
                    value={newAliasUtm}
                    onChange={e => setNewAliasUtm(e.target.value)}
                    placeholder="utm_campaign que vem no lead (ex: Search_MPT)"
                    className="bg-bg border border-border rounded-lg px-3 py-2 text-xs text-text-primary font-mono placeholder:text-text-dark focus:outline-none focus:border-accent/40"
                  />
                  <input
                    type="text"
                    list="campaign-name-list"
                    value={newAliasTarget}
                    onChange={e => setNewAliasTarget(e.target.value)}
                    placeholder="Campanha real (ex: medical-search-mpt)"
                    className="bg-bg border border-border rounded-lg px-3 py-2 text-xs text-text-primary font-mono placeholder:text-text-dark focus:outline-none focus:border-accent/40"
                  />
                  <datalist id="campaign-name-list">
                    {adCampaignNames.map(n => <option key={n} value={n} />)}
                  </datalist>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAliasNotes}
                    onChange={e => setNewAliasNotes(e.target.value)}
                    placeholder="Notas (opcional, ex: 'UTM antiga da LP X')"
                    className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-dark focus:outline-none focus:border-accent/40"
                  />
                  <button
                    onClick={addAlias}
                    disabled={savingAlias || !newAliasUtm.trim() || !newAliasTarget.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus size={12} />
                    {savingAlias ? "Salvando..." : "Adicionar"}
                  </button>
                </div>
              </div>

              {/* Lista */}
              {aliasesLoading ? (
                <div className="text-xs text-text-muted">Carregando...</div>
              ) : aliases.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-4 text-xs text-text-muted">
                  Nenhum alias cadastrado. Adicione um acima quando encontrar utm_campaign que não bate.
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  {aliases.map((a, i) => (
                    <div key={a.id} className={`px-4 py-3 flex items-center gap-3 ${i < aliases.length - 1 ? "border-b border-border" : ""}`}>
                      <code className="text-xs text-blue font-mono px-2 py-0.5 bg-blue/5 rounded">{a.alias_utm_campaign}</code>
                      <span className="text-text-muted text-xs">→</span>
                      <code className="text-xs text-accent font-mono px-2 py-0.5 bg-accent/5 rounded">{a.target_campaign_name}</code>
                      {a.notes && <span className="text-xs text-text-muted truncate flex-1">{a.notes}</span>}
                      <button
                        onClick={() => deleteAlias(a.id)}
                        className="ml-auto text-text-muted hover:text-red transition-colors"
                        title="Remover"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* ─── Formulários ─── */}
        <div className="flex items-center gap-2 mb-3">
          <FileText size={14} className="text-text-secondary" />
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-widest">Formulários Rastreados</h2>
        </div>

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
            onClick={fetchForms}
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
            <RefreshCw size={16} className="animate-spin mr-2" /> Carregando formulários...
          </div>
        ) : forms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <FileText size={32} className="text-text-dark" />
            <p className="text-text-secondary text-sm">Nenhum formulário encontrado ainda.</p>
            <p className="text-text-muted text-xs max-w-xs">
              Os formulários aparecerão aqui automaticamente após o primeiro lead ser recebido pelo webhook do RD Station.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {active.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-3">
                  Rastreados no dashboard
                </h2>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  {active.map((f, i) => (
                    <FormRow
                      key={f.id}
                      form={f}
                      last={i === active.length - 1}
                      toggling={toggling === f.id}
                      savingSheet={savingSheet === f.id}
                      onToggle={() => toggleForm(f)}
                      onSaveSheet={(id) => saveSheetId(f, id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {inactive.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-3">
                  Não rastreados
                </h2>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  {inactive.map((f, i) => (
                    <FormRow
                      key={f.id}
                      form={f}
                      last={i === inactive.length - 1}
                      toggling={toggling === f.id}
                      savingSheet={savingSheet === f.id}
                      onToggle={() => toggleForm(f)}
                      onSaveSheet={(id) => saveSheetId(f, id)}
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

function FormRow({ form, last, toggling, savingSheet, onToggle, onSaveSheet }: {
  form: TrackedForm;
  last: boolean;
  toggling: boolean;
  savingSheet: boolean;
  onToggle: () => void;
  onSaveSheet: (id: string) => void;
}) {
  const [sheetInput, setSheetInput] = useState(form.sheet_id ?? "");
  const [saved, setSaved] = useState(false);

  const firstSeen = new Date(form.first_seen).toLocaleDateString("pt-BR", {
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
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${sourceColor[form.source] ?? "text-text-muted border-border"}`}>
            {sourceLabel[form.source] ?? form.source}
          </span>
          <div>
            <div className="text-sm text-text-primary font-medium">
              {form.display_name ?? form.conversion_event}
            </div>
            <div className="text-xs text-text-muted font-mono mt-0.5">
              {form.conversion_event} · Primeiro lead: {firstSeen}
            </div>
          </div>
        </div>

        <button
          onClick={onToggle}
          disabled={toggling}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
            form.active ? "bg-accent" : "bg-border"
          } ${toggling ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow transition-transform duration-200 ${
              form.active ? "translate-x-5" : "translate-x-0"
            }`}
            style={{ backgroundColor: form.active ? "#0A0A0C" : "#F2F2F5" }}
          />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <FileSpreadsheet size={13} className="text-text-muted flex-shrink-0" />
        <input
          type="text"
          value={sheetInput}
          onChange={e => setSheetInput(e.target.value)}
          placeholder="ID da planilha Google (pesquisa de audiência)"
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
