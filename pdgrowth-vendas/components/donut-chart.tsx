"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { DonutSlice } from "@/lib/types";

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-card border border-border rounded-lg p-2.5 text-xs shadow-xl">
      <span className="text-text-secondary">{d.name}: </span>
      <span className="text-text-primary font-mono font-semibold">{d.value}</span>
      <span className="text-text-muted ml-1">({d.payload.pct}%)</span>
    </div>
  );
};

interface Props {
  title: string;
  data: DonutSlice[];
  centerLabel?: string;
}

export default function DonutChart({ title, data, centerLabel }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const enriched = data.map(d => ({ ...d, pct: ((d.value / total) * 100).toFixed(1) }));

  return (
    <div className="bg-card border border-border rounded-xl p-5 h-full">
      <span className="text-sm font-semibold text-text-primary block mb-4">{title}</span>
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0" style={{ width: 120, height: 120 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={enriched}
                cx="50%"
                cy="50%"
                innerRadius={36}
                outerRadius={55}
                dataKey="value"
                strokeWidth={0}
              >
                {enriched.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {centerLabel && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-bold font-mono text-text-primary">{total}</span>
              <span className="text-[10px] text-text-muted">{centerLabel}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {enriched.map((d, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                <span className="text-text-secondary truncate">{d.label}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-mono text-text-primary font-medium">{d.value}</span>
                <span className="text-text-muted w-10 text-right">{d.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
