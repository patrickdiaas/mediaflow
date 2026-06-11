export function KPICard({
  label, value, sub,
}: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-text-muted text-xs font-mono uppercase tracking-wider">{label}</div>
      <div className="text-text-primary text-2xl font-display font-bold mt-1.5">{value}</div>
      {sub && <div className="text-text-secondary text-xs mt-1">{sub}</div>}
    </div>
  );
}
