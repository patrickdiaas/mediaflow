import type { FunnelStep } from "@/lib/types";

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

interface FunnelMetrics {
  cpm: number;
  ctr: number;
  pageConvRate: number | null;
  checkoutConvRate: number | null;
  overallConvRate: number;
}

// Gradiente de cores do topo (neutro) até a base (verde vibrante)
const FUNNEL_COLORS = [
  { bg: "#1E293B", text: "#94A3B8", border: "#334155" },  // Impressões — slate
  { bg: "#1E2A3A", text: "#7DD3FC", border: "#0C4A6E" },  // Alcance — sky
  { bg: "#172554", text: "#60A5FA", border: "#1E40AF" },  // Cliques — blue
  { bg: "#1A2E05", text: "#A3E635", border: "#365314" },  // View Página — lime
  { bg: "#14280A", text: "#84CC16", border: "#3F6212" },  // Formulário — green
  { bg: "#0D2600", text: "#CAFF04", border: "#4D7C0F" },  // Leads — accent
];

export default function Funnel({ steps, metrics }: { steps: FunnelStep[]; metrics?: FunnelMetrics | null }) {
  const maxValue = steps.length > 0 ? steps[0].value : 0;

  const metricItems = !metrics ? [] : [
    { label: "CPM",              value: `R$ ${metrics.cpm.toFixed(2)}`,             color: "text-text-secondary" },
    { label: "CTR",              value: `${metrics.ctr.toFixed(2)}%`,               color: "text-blue" },
    ...(metrics.pageConvRate != null
      ? [{ label: "Conv. Página",     value: `${metrics.pageConvRate.toFixed(2)}%`,     color: "text-gold" }]
      : []),
    ...(metrics.checkoutConvRate != null
      ? [{ label: "Conv. Form.",      value: `${metrics.checkoutConvRate.toFixed(2)}%`, color: "text-accent" }]
      : []),
    ...(metrics.pageConvRate == null && metrics.checkoutConvRate == null
      ? [{ label: "Tx. Conv.",        value: `${metrics.overallConvRate.toFixed(2)}%`,  color: "text-accent" }]
      : []),
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-5 h-full flex flex-col">
      <h3 className="text-sm font-semibold text-text-primary mb-4">Funil de Conversão</h3>

      <div className="flex-1 flex flex-col justify-center gap-0">
        {steps.map((step, i) => {
          // Calcula a largura proporcional: primeiro step = 100%, último = mínimo 35%
          const widthPct = maxValue > 0
            ? Math.max(35, (step.value / maxValue) * 100)
            : 100;
          const colors = FUNNEL_COLORS[Math.min(i, FUNNEL_COLORS.length - 1)];
          const isLast = i === steps.length - 1;

          return (
            <div key={step.label} className="flex flex-col items-center">
              {/* Step bar */}
              <div
                className="relative rounded-lg flex items-center justify-between px-4 py-3 transition-all duration-500 border"
                style={{
                  width: `${widthPct}%`,
                  background: colors.bg,
                  borderColor: colors.border,
                  minHeight: 44,
                }}
              >
                <span
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: colors.text, opacity: 0.8 }}
                >
                  {step.label}
                </span>
                <span
                  className="font-mono text-sm font-bold"
                  style={{ color: colors.text }}
                >
                  {fmt(step.value)}
                </span>

                {/* Indicador de destaque no último step */}
                {isLast && (
                  <div
                    className="absolute -left-px top-0 bottom-0 w-1 rounded-l-lg"
                    style={{ background: colors.text }}
                  />
                )}
              </div>

              {/* Seta com taxa de conversão entre steps */}
              {step.rate !== undefined && (
                <div className="flex items-center gap-1.5 py-1">
                  <svg width="8" height="10" viewBox="0 0 8 10" fill="none" className="opacity-40">
                    <path d="M4 0L4 7M1 5L4 8L7 5" stroke="#6A6A7A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-[10px] font-mono text-text-muted">
                    {step.rate.toFixed(1)}%
                    {step.sublabel ? ` ${step.sublabel}` : ""}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Métricas resumidas */}
      {metricItems.length > 0 && (
        <div className={`mt-4 pt-3 border-t border-border grid gap-2 ${
          metricItems.length <= 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"
        }`}>
          {metricItems.map(m => (
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
