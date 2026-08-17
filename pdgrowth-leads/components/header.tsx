"use client";
import { useEffect, useState } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { useSession, canAccessClient } from "@/lib/use-session";
import { supabase } from "@/lib/supabase";
import { Calendar, Building2, Menu } from "lucide-react";

const periods = [
  { value: "today",     label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "last7",     label: "Últimos 7 dias" },
  { value: "last30",    label: "Últimos 30 dias" },
  { value: "thisMonth", label: "Este mês" },
  { value: "lastMonth", label: "Mês passado" },
  { value: "last90",    label: "Últimos 90 dias" },
];

interface Client { slug: string; name: string; display_name: string | null }

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const { period, setPeriod, client, setClient, setMobileSidebarOpen } = useDashboard();
  const [clients, setClients] = useState<Client[]>([]);
  const session = useSession();

  useEffect(() => {
    supabase
      .from("clients")
      .select("slug, name, display_name")
      .eq("active", true)
      .order("name")
      .then(({ data }) => {
        if (data && data.length > 0) setClients(data as Client[]);
      });
  }, []);

  // Filtra clientes por permissão da sessão. Admin vê todos, user limitado
  // vê só os allowed_clients.
  const visibleClients = clients.filter(c => canAccessClient(session, c.slug));

  // Se user tem só 1 cliente permitido, força esse selecionado.
  useEffect(() => {
    if (!session?.authenticated || session.is_admin) return;
    const ac = session.allowed_clients ?? [];
    if (ac.includes("*")) return;
    // Se selecionou "all" ou selecionou um cliente que não pode ver, ajusta
    if (client === "all" || !ac.includes(client)) {
      if (ac.length === 1) setClient(ac[0]);
      else if (ac.length > 1 && !ac.includes(client)) setClient(ac[0]);
    }
  }, [session, client, setClient]);

  // Usuário com só 1 cliente permitido não precisa ver o selector
  const hideSelector = !session?.is_admin
    && Array.isArray(session?.allowed_clients)
    && !session!.allowed_clients!.includes("*")
    && session!.allowed_clients!.length === 1;
  // Se allowed_clients não inclui "*", esconder a opção "Todas as contas"
  const canShowAllOption = session?.is_admin || (session?.allowed_clients ?? []).includes("*");

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden flex-shrink-0 w-8 h-8 rounded-lg border border-border bg-card flex items-center justify-center text-text-secondary hover:text-accent transition-colors"
          >
            <Menu size={16} />
          </button>
          <div className="min-w-0">
            <h1 className="text-base md:text-lg font-semibold text-text-primary truncate">{title}</h1>
            {subtitle && <p className="text-xs md:text-sm text-text-secondary mt-0.5 hidden sm:block">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {visibleClients.length > 0 && !hideSelector && (
            <div className="hidden sm:flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
              <Building2 size={14} className="text-text-muted flex-shrink-0" />
              <select
                value={client}
                onChange={e => setClient(e.target.value)}
                className="bg-transparent text-xs text-text-primary focus:outline-none cursor-pointer max-w-[140px]"
              >
                {canShowAllOption && <option value="all">Todas as contas</option>}
                {visibleClients.map(c => (
                  <option key={c.slug} value={c.slug}>{c.display_name ?? c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
            <Calendar size={14} className="text-text-muted flex-shrink-0" />
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="bg-transparent text-xs text-text-primary focus:outline-none cursor-pointer"
            >
              {periods.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Mobile: client selector abaixo do título */}
      {visibleClients.length > 0 && !hideSelector && (
        <div className="sm:hidden mt-3 flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
          <Building2 size={14} className="text-text-muted flex-shrink-0" />
          <select
            value={client}
            onChange={e => setClient(e.target.value)}
            className="bg-transparent text-xs text-text-primary focus:outline-none cursor-pointer w-full"
          >
            {canShowAllOption && <option value="all">Todas as contas</option>}
            {visibleClients.map(c => (
              <option key={c.slug} value={c.slug}>{c.display_name ?? c.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
