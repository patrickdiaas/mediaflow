import Link from "next/link";
import { Shell } from "@/components/shell";
import { createServiceClient } from "@/lib/supabase";
import { Plus, ExternalLink, Circle } from "lucide-react";

export const dynamic = "force-dynamic";

async function getFunnels() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("funis_funnels")
    .select("id, name, slug, status, created_at, clients:funis_clients(name)")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export default async function HomePage() {
  const funnels = await getFunnels();
  const host = process.env.NEXT_PUBLIC_PUBLIC_URL ?? "";

  return (
    <Shell title="Funis">
      <div className="flex items-center justify-between mb-4">
        <p className="text-text-secondary text-sm">{funnels.length} funil{funnels.length === 1 ? "" : "s"} cadastrado{funnels.length === 1 ? "" : "s"}</p>
        <Link href="/funnels/new"
          className="inline-flex items-center gap-1.5 bg-accent text-bg px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-accent/90">
          <Plus size={14} /> Novo funil
        </Link>
      </div>

      {funnels.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <p className="text-text-secondary text-sm mb-4">Nenhum funil ainda.</p>
          <Link href="/funnels/new"
            className="inline-flex items-center gap-1.5 bg-accent text-bg px-3 py-1.5 rounded-lg text-sm font-semibold">
            <Plus size={14} /> Criar primeiro funil
          </Link>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted text-xs uppercase tracking-wider border-b border-border">
                <th className="px-4 py-3 font-medium">Funil</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Link público</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {funnels.map((f: any) => (
                <tr key={f.id} className="border-b border-border last:border-0 hover:bg-card-hover">
                  <td className="px-4 py-3">
                    <Link href={`/funnels/${f.slug}`} className="text-text-primary hover:text-accent font-medium">{f.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{f.clients?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    <a href={`${host}/f/${f.slug}`} target="_blank"
                       className="text-text-secondary hover:text-accent inline-flex items-center gap-1">
                      /f/{f.slug} <ExternalLink size={11} />
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <Circle size={8} className={
                        f.status === "active" ? "fill-green text-green"
                        : f.status === "paused" ? "fill-gold text-gold"
                        : "fill-text-muted text-text-muted"
                      } />
                      <span className="text-text-secondary capitalize">{f.status}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/funnels/${f.slug}`} className="text-accent text-xs hover:underline">Abrir →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
