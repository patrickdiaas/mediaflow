import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { KPICard } from "@/components/kpi-card";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

type Row = {
  funnel_id: string;
  variant_id: string;
  utm_source: string;
  utm_campaign: string;
  utm_content: string;
  visitors: number;
  sales: number;
  revenue: number;
};

async function getData(slug: string) {
  const supabase = createServiceClient();
  const { data: funnel } = await supabase
    .from("funis_funnels").select("id, name, slug, clients:funis_clients(name)")
    .eq("slug", slug).maybeSingle();
  if (!funnel) return null;

  const { data: variants } = await supabase
    .from("funis_variants").select("id, name, step_id, funis_steps!inner(funnel_id)")
    .eq("funis_steps.funnel_id", funnel.id);

  const variantMap = new Map<string, string>(
    (variants ?? []).map(v => [v.id, v.name])
  );

  const { data: rows } = await supabase
    .from("funis_creative_performance").select("*").eq("funnel_id", funnel.id);

  return { funnel, rows: (rows ?? []) as Row[], variantMap };
}

export default async function CriativosPage({ params }: { params: { slug: string } }) {
  const data = await getData(params.slug);
  if (!data) notFound();
  const { funnel, rows, variantMap } = data;

  // Agrega por (utm_source, utm_campaign, utm_content) somando entre variantes
  const byAd = new Map<string, Row & { variantBreakdown: { variant_name: string; visitors: number; sales: number; revenue: number }[] }>();
  for (const r of rows) {
    const key = `${r.utm_source}|${r.utm_campaign}|${r.utm_content}`;
    if (!byAd.has(key)) {
      byAd.set(key, { ...r, visitors: 0, sales: 0, revenue: 0, variantBreakdown: [] });
    }
    const agg = byAd.get(key)!;
    agg.visitors += Number(r.visitors || 0);
    agg.sales    += Number(r.sales    || 0);
    agg.revenue  += Number(r.revenue  || 0);
    agg.variantBreakdown.push({
      variant_name: variantMap.get(r.variant_id) ?? "—",
      visitors: Number(r.visitors || 0),
      sales:    Number(r.sales    || 0),
      revenue:  Number(r.revenue  || 0),
    });
  }
  const adRows = Array.from(byAd.values()).sort((a, b) => b.revenue - a.revenue);

  const totals = adRows.reduce(
    (a, r) => ({ visitors: a.visitors + r.visitors, sales: a.sales + r.sales, revenue: a.revenue + r.revenue }),
    { visitors: 0, sales: 0, revenue: 0 }
  );

  return (
    <Shell>
      <div className="mb-6">
        <Link href={`/funnels/${funnel.slug}`} className="text-text-muted text-xs hover:text-text-secondary">← {funnel.name}</Link>
        <h1 className="text-xl font-display font-bold text-text-primary mt-1">Criativos · {funnel.name}</h1>
        <p className="text-text-secondary text-xs">Performance por <span className="font-mono">utm_source / utm_campaign / utm_content</span></p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <KPICard label="Visitantes (com UTM)" value={fmtNum(totals.visitors)} />
        <KPICard label="Vendas" value={fmtNum(totals.sales)} />
        <KPICard label="Receita" value={fmtBRL(totals.revenue)} />
      </div>

      {adRows.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center text-text-muted text-sm">
          Ainda não há tráfego com UTM. Configure seus anúncios com{" "}
          <span className="font-mono text-text-secondary">utm_source · utm_campaign · utm_content</span>{" "}
          (geralmente o ad_id).
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted text-xs uppercase tracking-wider border-b border-border">
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Campaign</th>
                <th className="px-4 py-3 font-medium">Content (ad_id)</th>
                <th className="px-4 py-3 font-medium text-right">Visitantes</th>
                <th className="px-4 py-3 font-medium text-right">Vendas</th>
                <th className="px-4 py-3 font-medium text-right">Receita</th>
                <th className="px-4 py-3 font-medium text-right">CVR</th>
              </tr>
            </thead>
            <tbody>
              {adRows.map((r, i) => {
                const cvr = r.visitors > 0 ? (r.sales / r.visitors) * 100 : 0;
                return (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-card-hover align-top">
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">{r.utm_source}</td>
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary truncate max-w-[180px]">{r.utm_campaign}</td>
                    <td className="px-4 py-3 font-mono text-xs text-text-primary">{r.utm_content}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmtNum(r.visitors)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmtNum(r.sales)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmtBRL(r.revenue)}</td>
                    <td className="px-4 py-3 text-right font-mono text-accent">{cvr.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
