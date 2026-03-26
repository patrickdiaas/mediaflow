"use client";
import { useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import type { TrendPoint } from "@/lib/types";

const metrics = [
  { key: "revenue", label: "Faturamento", color: "#00d084" },
  { key: "spend",   label: "Investimento", color: "#3b82f6" },
  { key: "sales",   label: "Vendas",       color: "#a855f7" },
  { key: "roas",    label: "ROAS",         color: "#f59e0b" },
] as const;

type MetricKey = typeof metrics[number]["key"];

function formatValue(key: MetricKey, value: number) {
  if (key === "roas")    return `${value.toFixed(2)}×`;
  if (key === "sales")   return String(value);
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs space-y-1.5 shadow-xl">
      <div className="text-text-secondary font-medium mb-2">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-text-secondary">{p.name}:</span>
          <span className="text-text-primary font-mono font-medium">{formatValue(p.dataKey, p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function TrendChart({ data }: { data: TrendPoint[] }) {
  const [active, setActive] = useState<Set<MetricKey>>(new Set<MetricKey>(["revenue", "spend"]));

  const toggle = (key: MetricKey) => {
    setActive(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-text-primary">Evolução no Período</span>
        <div className="flex gap-1">
          {metrics.map(m => (
            <button
              key={m.key}
              onClick={() => toggle(m.key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                active.has(m.key) ? "bg-border text-text-primary" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: active.has(m.key) ? m.color : "#4a5068" }} />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2230" />
          <XAxis dataKey="date" tick={{ fill: "#8b92a8", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#8b92a8", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          {metrics.filter(m => active.has(m.key)).map(m => (
            <Line
              key={m.key}
              type="monotone"
              dataKey={m.key}
              name={m.label}
              stroke={m.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: m.color }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
