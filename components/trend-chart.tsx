"use client";
import { useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { useDashboard } from "@/lib/dashboard-context";
import { trendData } from "@/lib/mock-data";

const views = {
  "lead-gen": [
    { key: "investimento", label: "Investimento", color: "#5b9bd5" },
    { key: "leads", label: "Leads", color: "#4ade80" },
    { key: "cliques", label: "Cliques", color: "#c9a84c" },
  ],
  ecommerce: [
    { key: "investimento", label: "Investimento", color: "#5b9bd5" },
    { key: "vendas", label: "Vendas", color: "#4ade80" },
    { key: "roas", label: "ROAS", color: "#c9a84c" },
  ],
};

interface TooltipProps { active?: boolean; payload?: Array<{ dataKey: string; color: string; name: string; value: number }>; label?: string; }
const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-xl">
      <p className="text-text-secondary mb-2 font-medium">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: entry.color }} />
          <span className="text-text-secondary">{entry.name}:</span>
          <span className="font-mono text-text-primary">{typeof entry.value === "number" && entry.value > 100 ? entry.value.toLocaleString("pt-BR") : entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function TrendChart() {
  const { mode, platform } = useDashboard();
  const [activeView, setActiveView] = useState<string[]>(["investimento", mode === "lead-gen" ? "leads" : "vendas"]);

  const data = trendData[platform][mode];
  const viewOptions = views[mode];

  const toggleView = (key: string) => {
    setActiveView(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-text-primary">Tendência de Performance</h3>
        <div className="flex gap-2">
          {viewOptions.map(v => (
            <button
              key={v.key}
              onClick={() => toggleView(v.key)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                activeView.includes(v.key)
                  ? "border-transparent text-white"
                  : "border-border text-text-secondary hover:text-text-primary"
              }`}
              style={activeView.includes(v.key) ? { background: v.color + "33", color: v.color, borderColor: v.color + "44" } : {}}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: v.color }} />
              {v.label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#171b28" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#6b7280", fontSize: 11, fontFamily: "DM Mono" }}
            tickLine={false}
            axisLine={false}
            interval={4}
          />
          <YAxis
            tick={{ fill: "#6b7280", fontSize: 11, fontFamily: "DM Mono" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          {viewOptions.map(v =>
            activeView.includes(v.key) ? (
              <Line
                key={v.key}
                type="monotone"
                dataKey={v.key}
                name={v.label}
                stroke={v.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: v.color }}
              />
            ) : null
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
