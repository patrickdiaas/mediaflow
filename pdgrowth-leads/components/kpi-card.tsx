import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { KPIData } from "@/lib/types";

const colorMap = {
  accent: { text: "text-accent",  border: "border-accent/20",  bg: "bg-accent/5"  },
  blue:   { text: "text-blue",    border: "border-blue/20",    bg: "bg-blue/5"    },
  gold:   { text: "text-gold",    border: "border-gold/20",    bg: "bg-gold/5"    },
  red:    { text: "text-red",     border: "border-red/20",     bg: "bg-red/5"     },
  purple: { text: "text-green",   border: "border-green/20",   bg: "bg-green/5"   },
  green:  { text: "text-green",   border: "border-green/20",   bg: "bg-green/5"   },
};

const badMetrics = ["reembolso", "cpa", "chargeback"];

export default function KPICard({ label, value, sub, trend, color = "accent" }: KPIData) {
  const c = colorMap[color as keyof typeof colorMap] ?? colorMap.accent;
  const isBad = badMetrics.some(k => label.toLowerCase().includes(k));

  const trendColor = trend === undefined ? ""
    : trend > 0
      ? isBad ? "text-red"   : "text-accent"
      : trend < 0
        ? isBad ? "text-accent" : "text-red"
        : "text-text-muted";

  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-4 relative overflow-hidden group hover:border-opacity-40 transition-colors`}>
      {/* Accent line top */}
      <div className={`absolute top-0 left-0 right-0 h-px ${c.bg} opacity-50`} />

      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs text-text-secondary font-medium leading-tight">{label}</span>
        {trend !== undefined && (
          <div className={`flex items-center gap-0.5 text-[11px] font-medium flex-shrink-0 ${trendColor}`}>
            {trend > 0 ? <TrendingUp size={11} /> : trend < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
            <span>{Math.abs(trend).toFixed(1)}%</span>
          </div>
        )}
      </div>
      <div className={`text-xl font-mono font-bold ${c.text} tracking-tight`}>{value}</div>
      {sub && <div className="text-[11px] text-text-muted mt-1 font-mono">{sub}</div>}
    </div>
  );
}
