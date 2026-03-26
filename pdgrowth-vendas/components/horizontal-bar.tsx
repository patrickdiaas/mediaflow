import type { HorizontalBarItem } from "@/lib/types";

interface Props {
  title: string;
  data: HorizontalBarItem[];
  valueLabel?: string;
}

export default function HorizontalBar({ title, data, valueLabel = "vendas" }: Props) {
  if (data.length === 0) return (
    <div className="bg-card border border-border rounded-xl p-5 h-full">
      <span className="text-sm font-semibold text-text-primary block mb-4">{title}</span>
      <p className="text-text-muted text-xs">Sem dados no período.</p>
    </div>
  );
  const max = Math.max(...data.map(d => d.value));

  return (
    <div className="bg-card border border-border rounded-xl p-5 h-full">
      <span className="text-sm font-semibold text-text-primary block mb-4">{title}</span>
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={i}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-text-secondary truncate max-w-[140px]" title={item.label}>
                {item.label}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-mono text-text-primary font-medium">{item.value}</span>
                <span className="text-accent font-mono font-semibold w-10 text-right">
                  {item.rate.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="w-full bg-bg rounded-full h-1.5 overflow-hidden">
              <div
                className="h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: `${(item.value / max) * 100}%`,
                  background: item.color ?? "#a855f7",
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-xs text-text-muted">
        <span>{valueLabel}</span>
        <span>% conversão</span>
      </div>
    </div>
  );
}
