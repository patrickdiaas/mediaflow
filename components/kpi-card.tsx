"use client";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  accent?: "green" | "blue" | "gold" | "red" | "default";
  large?: boolean;
}

export default function KPICard({ label, value, sub, trend, accent = "default", large }: KPICardProps) {
  const accentColors = {
    green: { text: "text-accent", border: "border-accent/20", bg: "bg-accent/5" },
    blue: { text: "text-blue", border: "border-blue/20", bg: "bg-blue/5" },
    gold: { text: "text-gold", border: "border-gold/20", bg: "bg-gold/5" },
    red: { text: "text-red", border: "border-red/20", bg: "bg-red/5" },
    default: { text: "text-text-primary", border: "border-border", bg: "" },
  };
  const colors = accentColors[accent];

  const trendColor = !trend ? "text-text-muted" : trend > 0 ? "text-accent" : "text-red";
  const TrendIcon = !trend ? Minus : trend > 0 ? TrendingUp : TrendingDown;

  return (
    <div className={`bg-card rounded-xl border ${colors.border} p-4 ${colors.bg} flex flex-col gap-2`}>
      <span className="text-xs text-text-secondary font-medium">{label}</span>
      <span className={`font-mono font-semibold ${colors.text} ${large ? "text-2xl" : "text-xl"} tracking-tight leading-none`}>
        {value}
      </span>
      <div className="flex items-center justify-between">
        {sub && <span className="text-xs text-text-muted">{sub}</span>}
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-mono ${trendColor} ml-auto`}>
            <TrendIcon size={11} />
            <span>{Math.abs(trend).toFixed(1)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
