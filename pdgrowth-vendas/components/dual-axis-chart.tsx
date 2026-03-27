"use client";
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import type { TrendPoint } from "@/lib/types";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-3 text-xs space-y-1.5 shadow-2xl">
      <div className="text-text-secondary font-medium mb-2">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-text-secondary">{p.name}:</span>
          <span className="text-text-primary font-mono font-semibold">
            R$ {Number(p.value).toLocaleString("pt-BR")}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function DualAxisChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <span className="text-sm font-semibold text-text-primary">Faturamento e Investimento por Dia</span>
        <div className="flex items-center gap-4 text-xs text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-blue/70 inline-block" /> Faturamento
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-red inline-block" /> Investimento
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#24242C" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "#6A6A7A", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: "#6A6A7A", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: "#6A6A7A", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#24242C", opacity: 0.8 }} />
          <Bar
            yAxisId="left"
            dataKey="revenue"
            name="Faturamento"
            fill="#3B82C4"
            fillOpacity={0.7}
            radius={[3, 3, 0, 0]}
            maxBarSize={32}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="spend"
            name="Investimento"
            stroke="#EF4444"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: "#EF4444" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
