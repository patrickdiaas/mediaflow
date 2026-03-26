"use client";
import { useDashboard } from "@/lib/dashboard-context";
import { Calendar } from "lucide-react";

const periods = [
  { value: "today",    label: "Hoje" },
  { value: "yesterday",label: "Ontem" },
  { value: "last7",    label: "Últimos 7 dias" },
  { value: "last30",   label: "Últimos 30 dias" },
  { value: "thisMonth",label: "Este mês" },
  { value: "lastMonth",label: "Mês passado" },
  { value: "last90",   label: "Últimos 90 dias" },
];

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const { period, setPeriod } = useDashboard();

  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
        {subtitle && <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
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
