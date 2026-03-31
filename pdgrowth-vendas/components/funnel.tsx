import type { FunnelStep } from "@/lib/types";

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const colors = ["#24242C", "#1a2200", "#2e3600", "#3d4800", "#CAFF04"];

interface FunnelMetrics { cpm: number; ctr: number; convRate: number; }

export default function Funnel({ steps, metrics }: { steps: FunnelStep[]; metrics?: FunnelMetrics | null }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 h-full">
      <h3 className="text-sm font-semibold text-text-primary mb-5">Funil de Conversão</h3>
      <div className="space-y-1">
        {steps.map((step, i) => (
          <div key={step.label}>
            <div className="flex items-center justify-center" style={{ paddingInline: `${i * 5}%` }}>
              <div
                className="w-full rounded flex items-center justify-between px-3 py-2.5 text-xs font-semibold"
                style={{ background: colors[Math.min(i, colors.length - 1)], color: i === steps.length - 1 ? "#0A0A0C" : "#F2F2F5" }}
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
      {metrics && (
        <div className="mt-4 pt-3 border-t border-border grid grid-cols-3 gap-2">
          {[
            { label: "CPM",       value: `R$ ${metrics.cpm.toFixed(2)}`,   color: "text-text-secondary" },
            { label: "CTR",       value: `${metrics.ctr.toFixed(2)}%`,     color: "text-blue"           },
            { label: "Tx. Conv.", value: `${metrics.convRate.toFixed(2)}%`, color: "text-accent"         },
          ].map(m => (
            <div key={m.label} className="bg-bg rounded-lg px-2.5 py-2 text-center">
              <div className="text-[10px] text-text-muted mb-0.5">{m.label}</div>
              <div className={`text-xs font-mono font-semibold ${m.color}`}>{m.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
