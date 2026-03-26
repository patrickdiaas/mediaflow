import type { FunnelStep } from "@/lib/types";

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const colors = ["#a855f7", "#7c3aed", "#6366f1", "#4f46e5", "#00d084"];

export default function Funnel({ steps }: { steps: FunnelStep[] }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 h-full">
      <h3 className="text-sm font-semibold text-text-primary mb-5">Funil de Vendas — Perpétuo</h3>
      <div className="space-y-1">
        {steps.map((step, i) => (
          <div key={step.label}>
            <div className="flex items-center justify-center" style={{ paddingInline: `${i * 5}%` }}>
              <div
                className="w-full rounded flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-white"
                style={{ background: colors[i] }}
              >
                <span>{step.label}</span>
                <span className="font-mono">{fmt(step.value)}</span>
              </div>
            </div>
            {step.rate !== undefined && (
              <div className="flex items-center justify-center py-0.5">
                <span className="text-[10px] text-text-muted">
                  ▼ {step.rate.toFixed(1)}%
                  {step.sublabel ? ` · ${step.sublabel}` : ""}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-2">
        {[
          { label: "CPM",          value: "R$ 15,11", color: "text-text-secondary" },
          { label: "CTR",          value: "2,0%",     color: "text-blue" },
          { label: "Tx. Checkout", value: "10,0%",    color: "text-gold" },
          { label: "Tx. Conv.",    value: "1,68%",    color: "text-accent" },
        ].map(m => (
          <div key={m.label} className="bg-bg rounded-lg px-2.5 py-2 text-center">
            <div className="text-[10px] text-text-muted mb-0.5">{m.label}</div>
            <div className={`text-xs font-mono font-semibold ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
