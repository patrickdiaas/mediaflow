// Retorna o intervalo de datas ajustado para o fuso horário de Brasília (UTC-3).
// Leads (converted_at) podem cair em UTC com offset — mesma lógica do dash de vendas.
export function getLeadDates(period: string): { since: string; until: string } {
  const { since, until } = getPeriodDates(period);

  const untilDate = new Date(until + "T00:00:00Z");
  untilDate.setUTCDate(untilDate.getUTCDate() + 1);
  const untilNext = untilDate.toISOString().split("T")[0];

  return {
    since: `${since}T03:00:00`,
    until: `${untilNext}T02:59:59`,
  };
}

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
