// Supabase/PostgREST corta silenciosamente em 1000 linhas por request quando
// não há .range() explícito — sem aviso, sem erro, só corta. Com o volume de
// dados crescendo (mais clientes, mais dias, mais campanhas), várias telas
// já passam de 1000 linhas em ad_campaigns/leads/etc e perdem registros de
// forma dependente da ordem física da tabela (não há ORDER BY nessas queries).
//
// Uso: em vez de `await supabase.from("x").select(...).eq(...)`, construa a
// query dentro de uma função e pagine com fetchAllRows:
//
//   const rows = await fetchAllRows((from, to) =>
//     supabase.from("x").select(...).eq(...).range(from, to)
//   );

const PAGE_SIZE = 1000;
const MAX_PAGES = 100; // safety valve — 100k linhas no máximo

export async function fetchAllRows<T = any>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
): Promise<T[]> {
  const results: T[] = [];
  let page = 0;
  while (page < MAX_PAGES) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) break;
    const rows = data ?? [];
    results.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    page++;
  }
  return results;
}
