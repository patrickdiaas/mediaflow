// Retorna o intervalo de datas ajustado para o fuso horário de Brasília (UTC-3).
// Usado nas queries de sales (created_at) para não perder vendas entre 21h-23h59 BRT.
// Ex: venda às 23h30 BRT aparece no Supabase como 02h30 UTC do dia seguinte.
export function getSalesDates(period: string): { since: string; until: string } {
  const { since, until } = getPeriodDates(period);

  // Próximo dia após until (para cobrir até 02:59:59 UTC = 23:59:59 BRT)
  const untilDate = new Date(until + "T00:00:00Z");
  untilDate.setUTCDate(untilDate.getUTCDate() + 1);
  const untilNext = untilDate.toISOString().split("T")[0];

  return {
    since: `${since}T03:00:00`,      // 03:00 UTC = 00:00 BRT
    until: `${untilNext}T02:59:59`,  // 02:59 UTC próximo dia = 23:59 BRT
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
