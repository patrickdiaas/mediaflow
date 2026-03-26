export function getPeriodDates(period: string): { from: string; to: string } {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case "today":
      return { from: today.toISOString(), to: now.toISOString() };
    case "yesterday": {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return { from: y.toISOString(), to: today.toISOString() };
    }
    case "last7": {
      const d = new Date(today); d.setDate(d.getDate() - 7);
      return { from: d.toISOString(), to: now.toISOString() };
    }
    case "last30": {
      const d = new Date(today); d.setDate(d.getDate() - 30);
      return { from: d.toISOString(), to: now.toISOString() };
    }
    case "thisMonth": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: d.toISOString(), to: now.toISOString() };
    }
    case "lastMonth": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end   = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    default: {
      const d = new Date(today); d.setDate(d.getDate() - 30);
      return { from: d.toISOString(), to: now.toISOString() };
    }
  }
}
