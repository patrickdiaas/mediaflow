export function getPeriodDates(period: string): { since: string; until: string } {
  const fmt   = (d: Date) => d.toISOString().split("T")[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (period === "today") {
    const s = fmt(today);
    return { since: s, until: s };
  }
  if (period === "yesterday") {
    const d = new Date(today); d.setDate(d.getDate() - 1);
    const s = fmt(d);
    return { since: s, until: s };
  }
  if (period === "thisMonth") {
    const since = new Date(today.getFullYear(), today.getMonth(), 1);
    const until = new Date(today); until.setDate(until.getDate() - 1);
    return { since: fmt(since), until: fmt(until) };
  }
  if (period === "lastMonth") {
    const since = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const until = new Date(today.getFullYear(), today.getMonth(), 0);
    return { since: fmt(since), until: fmt(until) };
  }
  const days  = period === "last7" ? 7 : period === "last90" ? 90 : 30;
  const until = new Date(today); until.setDate(until.getDate() - 1);
  const since = new Date(until); since.setDate(since.getDate() - days + 1);
  return { since: fmt(since), until: fmt(until) };
}
