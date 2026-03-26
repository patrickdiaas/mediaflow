import type { FunnelStep } from "@/lib/types";

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function Funnel({ steps }: { steps: FunnelStep[] }) {
  const max = steps[0]?.value ?? 1;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-medium text-text-primary mb-5">Funil de Conversão</h3>
      <div className="space-y-2">
        {steps.map((step, i) => {
          const pct = (step.value / max) * 100;
          const colors = ["#00d084", "#3b82f6", "#a855f7", "#f59e0b", "#00d084"];
          const color = colors[i % colors.length];

          return (
            <div key={step.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-text-secondary font-medium">{step.label}</span>
                <div className="flex items-center gap-3">
                  {step.rate !== undefined && (
                    <span className="text-text-muted font-mono">
                      {step.rate.toFixed(1)}% conv.
                    </span>
                  )}
                  <span className="text-text-primary font-mono font-medium">{fmt(step.value)}</span>
                </div>
              </div>
              <div className="w-full bg-bg rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
