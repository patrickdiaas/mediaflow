import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { KPIData } from "@/lib/types";

const colorMap = {
  accent: { text: "text-accent",  bg: "bg-accent/10",  border: "border-accent/20"  },
  blue:   { text: "text-blue",    bg: "bg-blue/10",    border: "border-blue/20"    },
  gold:   { text: "text-gold",    bg: "bg-gold/10",    border: "border-gold/20"    },
  red:    { text: "text-red",     bg: "bg-red/10",     border: "border-red/20"     },
  purple: { text: "text-purple",  bg: "bg-purple/10",  border: "border-purple/20"  },
};

export default function KPICard({ label, value, sub, trend, color = "accent" }: KPIData) {
  const c = colorMap[color];

  const trendPositive = trend !== undefined && trend > 0;
  const trendNegative = trend !== undefined && trend < 0;

  // For "bad" metrics (refunds, CPA), invert color logic
  const isBadMetric = color === "red" || label.toLowerCase().includes("reembolso") || label.toLowerCase().includes("cpa");
  const trendColor = trend === undefined ? ""
    : trendPositive
      ? isBadMetric ? "text-red" : "text-accent"
      : trendNegative
        ? isBadMetric ? "text-accent" : "text-red"
        : "text-text-muted";

  return (
    <div className={`bg-card border ${c.border} rounded-xl p-4`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-xs text-text-secondary font-medium">{label}</span>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            {trendPositive ? <TrendingUp size={12} /> : trendNegative ? <TrendingDown size={12} /> : <Minus size={12} />}
            <span>{Math.abs(trend).toFixed(1)}%</span>
          </div>
        )}
      </div>
      <div className={`text-xl font-bold font-mono ${c.text}`}>{value}</div>
      {sub && <div className="text-xs text-text-muted mt-1">{sub}</div>}
    </div>
  );
}
