import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { KPICard } from "@/components/kpi-card";
import { createServiceClient } from "@/lib/supabase";
import { ExternalLink, Copy } from "lucide-react";
import { CopyButton } from "./copy-button";

export const dynamic = "force-dynamic";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

async function getData(slug: string) {
  const supabase = createServiceClient();

  const { data: funnel } = await supabase
    .from("funis_funnels")
    .select("id, name, slug, status, created_at, notes, clients:funis_clients(name)")
    .eq("slug", slug).maybeSingle();
  if (!funnel) return null;

  const { data: steps } = await supabase
    .from("funis_steps")
    .select("id, ordem, type, name")
    .eq("funnel_id", funnel.id).order("ordem");

  const stepIds = (steps ?? []).map(s => s.id);
  const variants = stepIds.length
    ? (await supabase.from("funis_variants")
        .select("id, step_id, name, destination_url, weight, status")
        .in("step_id", stepIds)).data ?? []
    : [];

  const metrics = (await supabase
    .from("funis_variant_metrics").select("*").eq("funnel_id", funnel.id)).data ?? [];

  return { funnel, steps: steps ?? [], variants, metrics };
}

export default async function FunnelDetail({ params }: { params: { slug: string } }) {
  const data = await getData(params.slug);
  if (!data) notFound();
  const { funnel, steps, variants, metrics } = data;

  const host = process.env.NEXT_PUBLIC_PUBLIC_URL ?? "";
  const publicUrl = `${host}/f/${funnel.slug}`;
  const pixelTag = `<script async src="${host}/p.js"></script>`;

  const totals = metrics.reduce(
    (a: any, v: any) => ({
      visitors: a.visitors + Number(v.visitors || 0),
      sales:    a.sales    + Number(v.sales || 0),
      revenue:  a.revenue  + Number(v.revenue || 0),
    }),
    { visitors: 0, sales: 0, revenue: 0 }
  );
  const cvr = totals.visitors > 0 ? (totals.sales / totals.visitors) * 100 : 0;

  return (
    <Shell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-text-muted text-xs hover:text-text-secondary">← Funis</Link>
          <h1 className="text-xl font-display font-bold text-text-primary mt-1">{funnel.name}</h1>
          <p className="text-text-secondary text-xs">{(funnel as any).clients?.name ?? "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/funnels/${funnel.slug}/criativos`}
            className="border border-border bg-card px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:text-text-primary">
            Criativos
          </Link>
          <Link href={`/funnels/${funnel.slug}/edit`}
            className="border border-border bg-card px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:text-text-primary">
            Editar funil
          </Link>
          <a href={publicUrl} target="_blank"
            className="inline-flex items-center gap-1.5 border border-border bg-card px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:text-text-primary">
            Abrir link <ExternalLink size={12} />
          </a>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <KPICard label="Visitantes únicos" value={fmtNum(totals.visitors)} />
        <KPICard label="Vendas atribuídas" value={fmtNum(totals.sales)} />
        <KPICard label="Receita" value={fmtBRL(totals.revenue)} />
        <KPICard label="CVR média" value={`${cvr.toFixed(2)}%`} />
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Setup</h2>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-text-secondary text-xs mb-1.5">Link público (use nos anúncios):</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 font-mono text-xs text-accent">{publicUrl}</code>
              <CopyButton text={publicUrl} />
            </div>
          </div>
          <div>
            <p className="text-text-secondary text-xs mb-1.5">Pixel — cole em TODAS as sales pages e na página de obrigado:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 font-mono text-xs text-text-primary">{pixelTag}</code>
              <CopyButton text={pixelTag} />
            </div>
          </div>
        </div>
      </div>

      {steps.map(step => {
        const stepVariants = variants.filter(v => v.step_id === step.id);
        const stepMetrics = metrics.filter((m: any) => m.step_id === step.id);
        return (
          <div key={step.id} className="bg-card border border-border rounded-xl overflow-hidden mb-4">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <span className="text-text-muted text-xs font-mono">{step.ordem.toString().padStart(2, "0")}</span>
              <h3 className="text-sm font-semibold text-text-primary">{step.name}</h3>
              <span className="text-text-muted text-xs font-mono uppercase">/ {step.type}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted text-xs uppercase tracking-wider border-b border-border">
                  <th className="px-5 py-2 font-medium">Variante</th>
                  <th className="px-5 py-2 font-medium">Destino</th>
                  <th className="px-5 py-2 font-medium text-right">Peso</th>
                  <th className="px-5 py-2 font-medium text-right">Visitantes</th>
                  <th className="px-5 py-2 font-medium text-right">Vendas</th>
                  <th className="px-5 py-2 font-medium text-right">Receita</th>
                  <th className="px-5 py-2 font-medium text-right">CVR</th>
                </tr>
              </thead>
              <tbody>
                {stepVariants.map((v: any) => {
                  const m: any = stepMetrics.find((x: any) => x.variant_id === v.id) ?? {};
                  return (
                    <tr key={v.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-2.5">
                        <span className="text-text-primary font-medium">{v.name}</span>
                        {v.status === "paused" && <span className="ml-2 text-xs text-gold">pausada</span>}
                      </td>
                      <td className="px-5 py-2.5">
                        <a href={v.destination_url} target="_blank"
                          className="text-text-secondary text-xs font-mono hover:text-accent truncate inline-block max-w-[280px] align-middle">
                          {v.destination_url}
                        </a>
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono">{v.weight}%</td>
                      <td className="px-5 py-2.5 text-right font-mono">{fmtNum(Number(m.visitors || 0))}</td>
                      <td className="px-5 py-2.5 text-right font-mono">{fmtNum(Number(m.sales || 0))}</td>
                      <td className="px-5 py-2.5 text-right font-mono">{fmtBRL(Number(m.revenue || 0))}</td>
                      <td className="px-5 py-2.5 text-right font-mono text-accent">{Number(m.cvr_pct || 0).toFixed(2)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </Shell>
  );
}
