"use client";
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
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
            {p.dataKey === "leads" ? p.value : `R$ ${Number(p.value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </span>
        </div>
      ))}
    </div>
  );
};

interface Props {
  data: TrendPoint[];
  showCpl?: boolean;
}

export default function DualAxisChart({ data, showCpl = false }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <span className="text-sm font-semibold text-text-primary">Leads e Investimento por Dia</span>
        <div className="flex items-center gap-4 text-xs text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-accent/70 inline-block" /> Leads
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-red inline-block" /> Investimento
          </span>
          {showCpl && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-gold inline-block" /> CPL
            </span>
          )}
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
            allowDecimals={false}
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
            dataKey="leads"
            name="Leads"
            fill="#CAFF04"
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
          {showCpl && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cpl"
              name="CPL"
              stroke="#F59E0B"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 4, fill: "#F59E0B" }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
