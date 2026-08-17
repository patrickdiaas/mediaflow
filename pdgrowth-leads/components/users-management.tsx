"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/use-session";
import { Users, Plus, Trash2, Eye, EyeOff, Shield } from "lucide-react";

interface DashUser {
  id: string;
  email: string;
  display_name: string | null;
  allowed_clients: string[];
  allowed_pages: string[];
  is_readonly: boolean;
  active: boolean;
  created_at: string;
}

const PAGE_OPTIONS = [
  { path: "/",              label: "Overview"      },
  { path: "/campanhas",     label: "Campanhas"     },
  { path: "/criativos",     label: "Criativos"     },
  { path: "/palavras-chave", label: "Palavras-chave" },
  { path: "/audiencia",     label: "Audiência"     },
  { path: "/relatorios",    label: "Relatórios"    },
  { path: "/analises",      label: "Análises IA"   },
  { path: "/configuracoes", label: "Configurações" },
];

interface ClientOpt { slug: string; name: string; display_name: string | null }

export default function UsersManagement() {
  const session = useSession();
  const [users, setUsers] = useState<DashUser[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [allowedClients, setAllowedClients] = useState<string[]>([]);
  const [allowedPages, setAllowedPages] = useState<string[]>(["/", "/campanhas", "/criativos"]);
  const [isReadonly, setIsReadonly] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Só admin vê e usa isso
  const isAdmin = session?.is_admin === true;

  async function fetchUsers() {
    if (!isAdmin) return;
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const json = await res.json();
    if (res.ok) setUsers(json.data ?? []);
    else setError(json.error ?? "Erro ao listar usuários");
    setLoading(false);
  }

  async function fetchClients() {
    const { data } = await supabase
      .from("clients").select("slug, name, display_name")
      .eq("active", true).order("name");
    setClients((data ?? []) as ClientOpt[]);
  }

  useEffect(() => { fetchUsers(); fetchClients(); }, [isAdmin]);

  function resetForm() {
    setEmail(""); setDisplayName(""); setPassword(""); setShowPassword(false);
    setAllowedClients([]); setAllowedPages(["/", "/campanhas", "/criativos"]);
    setIsReadonly(true); setEditingId(null);
  }

  function loadForEdit(u: DashUser) {
    setEditingId(u.id);
    setEmail(u.email);
    setDisplayName(u.display_name ?? "");
    setPassword(""); // deixa vazio, senha só muda se preencher
    setAllowedClients(u.allowed_clients);
    setAllowedPages(u.allowed_pages);
    setIsReadonly(u.is_readonly);
  }

  async function saveUser() {
    setSaving(true); setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email, display_name: displayName || null, password: password || undefined,
        allowed_clients: allowedClients, allowed_pages: allowedPages,
        is_readonly: isReadonly, active: true,
      }),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error ?? "Erro ao salvar");
    else { resetForm(); fetchUsers(); }
    setSaving(false);
  }

  async function deleteUser(id: string, email: string) {
    if (!confirm(`Remover usuário ${email}?`)) return;
    const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
    if (res.ok) fetchUsers();
  }

  function toggleClient(slug: string) {
    setAllowedClients(cur => cur.includes(slug) ? cur.filter(c => c !== slug) : [...cur, slug]);
  }

  function togglePage(path: string) {
    setAllowedPages(cur => cur.includes(path) ? cur.filter(p => p !== path) : [...cur, path]);
  }

  if (!isAdmin) return null; // esconde a seção pra não-admin

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Users size={14} className="text-accent" />
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-widest">Usuários do Dashboard</h2>
      </div>
      <p className="text-xs text-text-muted mb-3 leading-relaxed">
        Gerencia acesso de usuários leitores ao dashboard (ex: agência de tráfego que só visualiza).
        Admin (senha do env) sempre tem acesso total, independente do que estiver aqui.
      </p>

      {/* Form de novo/editar */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-text-primary">
            {editingId ? "Editar usuário" : "Novo usuário"}
          </span>
          {editingId && (
            <button onClick={resetForm} className="text-[10px] text-text-muted hover:text-text-primary underline">
              Cancelar edição
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@agencia.com" autoComplete="off"
            className="bg-bg border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-dark focus:outline-none focus:border-accent/40" />
          <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Nome (opcional)"
            className="bg-bg border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-dark focus:outline-none focus:border-accent/40" />
        </div>

        <div className="relative mb-3">
          <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
            placeholder={editingId ? "Nova senha (deixe vazio pra manter)" : "Senha"} autoComplete="new-password"
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 pr-9 text-xs text-text-primary placeholder:text-text-dark focus:outline-none focus:border-accent/40" />
          <button type="button" onClick={() => setShowPassword(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
            {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        </div>

        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">Clientes permitidos</div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setAllowedClients(allowedClients.includes("*") ? [] : ["*"])}
              className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
                allowedClients.includes("*") ? "bg-accent/10 text-accent border-accent/30" : "text-text-muted border-border hover:border-border-light"
              }`}>* todos</button>
            {clients.map(c => (
              <button key={c.slug} type="button" onClick={() => toggleClient(c.slug)}
                className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
                  allowedClients.includes(c.slug) ? "bg-accent/10 text-accent border-accent/30" : "text-text-muted border-border hover:border-border-light"
                }`} disabled={allowedClients.includes("*")}>{c.slug}</button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">Páginas permitidas</div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setAllowedPages(allowedPages.includes("*") ? [] : ["*"])}
              className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
                allowedPages.includes("*") ? "bg-accent/10 text-accent border-accent/30" : "text-text-muted border-border hover:border-border-light"
              }`}>* todas</button>
            {PAGE_OPTIONS.map(p => (
              <button key={p.path} type="button" onClick={() => togglePage(p.path)}
                className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                  allowedPages.includes(p.path) ? "bg-accent/10 text-accent border-accent/30" : "text-text-muted border-border hover:border-border-light"
                }`} disabled={allowedPages.includes("*")}>{p.label}</button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 mb-3 text-xs text-text-secondary cursor-pointer">
          <input type="checkbox" checked={isReadonly} onChange={e => setIsReadonly(e.target.checked)}
            className="rounded border-border" />
          Somente leitura (esconde botões de edição — notas, aliases, configurações)
        </label>

        {error && <div className="text-xs text-red mb-2">{error}</div>}

        <button onClick={saveUser} disabled={saving || !email || (!editingId && !password)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <Plus size={12} />
          {saving ? "Salvando..." : editingId ? "Atualizar usuário" : "Adicionar usuário"}
        </button>
      </div>

      {/* Lista de usuários */}
      {loading ? (
        <div className="text-xs text-text-muted">Carregando...</div>
      ) : users.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-4 text-xs text-text-muted">
          Nenhum usuário cadastrado. Adicione um acima pra dar acesso limitado ao dashboard.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {users.map((u, i) => (
            <div key={u.id} className={`px-4 py-3 ${i < users.length - 1 ? "border-b border-border" : ""}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-text-primary">{u.display_name || u.email}</span>
                    {u.is_readonly && (
                      <span className="text-[9px] font-bold text-gold border border-gold/30 bg-gold/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        <Eye size={9} className="inline mr-0.5" /> Leitura
                      </span>
                    )}
                    {!u.active && (
                      <span className="text-[9px] font-bold text-red border border-red/30 bg-red/10 px-1.5 py-0.5 rounded uppercase tracking-wider">Inativo</span>
                    )}
                  </div>
                  {u.display_name && <div className="text-[10px] text-text-muted">{u.email}</div>}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {u.allowed_clients.map(c => (
                      <span key={c} className="text-[9px] font-mono text-blue border border-blue/20 bg-blue/5 px-1.5 py-0.5 rounded">{c}</span>
                    ))}
                    {u.allowed_pages.map(p => (
                      <span key={p} className="text-[9px] font-mono text-text-muted border border-border px-1.5 py-0.5 rounded">{p}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => loadForEdit(u)}
                    className="text-[11px] text-blue hover:underline">editar</button>
                  <button onClick={() => deleteUser(u.id, u.email)}
                    className="text-text-muted hover:text-red transition-colors" title="Remover">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-[10px] text-text-dark mt-2 flex items-center gap-1">
        <Shield size={10} />
        Senhas hasheadas com scrypt (irreversível). Só admin vê essa seção.
      </div>
    </section>
  );
}
