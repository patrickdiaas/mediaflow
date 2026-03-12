"use client";
import { useDashboard } from "@/lib/dashboard-context";
import { kpiData } from "@/lib/mock-data";

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("pt-BR");
}

function pct(a: number, b: number) {
  if (!b) return "0%";
  return ((a / b) * 100).toFixed(1) + "%";
}

export default function Funnel() {
  const { mode, platform } = useDashboard();
  const kpi = kpiData[platform][mode];

  const steps =
    mode === "lead-gen"
      ? [
          { label: "Impressões", value: kpi.impressoes, color: "#5b9bd5", width: 100 },
          { label: "Cliques", value: kpi.cliques, color: "#4ade80", width: 75 },
          { label: "LPV (Connect)", value: kpi.lpvCliques, color: "#c9a84c", width: 56 },
          { label: "Leads Plataforma", value: kpi.leadsPlataforma, color: "#a78bfa", width: 40 },
          { label: "Leads CRM", value: kpi.leadsCRM, color: "#f87171", width: 28 },
        ]
      : [
          { label: "Impressões", value: kpi.impressoes, color: "#5b9bd5", width: 100 },
          { label: "Cliques", value: kpi.cliques, color: "#4ade80", width: 75 },
          { label: "LPV (Connect)", value: kpi.lpvCliques, color: "#c9a84c", width: 56 },
          { label: "Vendas", value: kpi.vendas, color: "#f87171", width: 28 },
        ];

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-5">Funil de Conversão</h3>
      <div className="space-y-2">
        {steps.map((step, i) => {
          const prev = i > 0 ? steps[i - 1].value : step.value;
          return (
            <div key={step.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-text-secondary">{step.label}</span>
                <div className="flex items-center gap-3">
                  {i > 0 && (
                    <span className="text-xs font-mono text-text-muted">{pct(step.value, prev)}</span>
                  )}
                  <span className="text-xs font-mono" style={{ color: step.color }}>{fmt(step.value)}</span>
                </div>
              </div>
              <div className="h-7 bg-border rounded-lg overflow-hidden flex items-center">
                <div
                  className="h-full rounded-lg transition-all duration-500 flex items-center justify-end pr-3"
                  style={{ width: `${step.width}%`, background: step.color + "40", borderRight: `2px solid ${step.color}` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
