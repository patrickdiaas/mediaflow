"use client";
import { useEffect, useState } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { supabase } from "@/lib/supabase";
import { Calendar, Building2 } from "lucide-react";

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
  const { period, setPeriod, client, setClient } = useDashboard();
  const [clients, setClients] = useState<Client[]>([]);

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

  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
        {subtitle && <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        {clients.length > 0 && (
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
            <Building2 size={14} className="text-text-muted" />
            <select
              value={client}
              onChange={e => setClient(e.target.value)}
              className="bg-transparent text-xs text-text-primary focus:outline-none cursor-pointer max-w-[180px]"
            >
              <option value="all">Todas as contas</option>
              {clients.map(c => (
                <option key={c.slug} value={c.slug}>{c.display_name ?? c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
          <Calendar size={14} className="text-text-muted" />
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
  );
}
