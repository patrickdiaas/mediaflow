import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { createServiceClient } from "@/lib/supabase";
import { Builder } from "./builder";

export const dynamic = "force-dynamic";

async function getData(slug: string) {
  const supabase = createServiceClient();
  const { data: funnel } = await supabase
    .from("funis_funnels")
    .select("id, name, slug, status, client_id, notes, created_at, clients:funis_clients(name)")
    .eq("slug", slug).maybeSingle();
  if (!funnel) return null;

  const { data: steps } = await supabase
    .from("funis_steps").select("id, ordem, type, name")
    .eq("funnel_id", funnel.id).order("ordem");

  const stepIds = (steps ?? []).map(s => s.id);
  const variants = stepIds.length
    ? (await supabase.from("funis_variants")
        .select("id, step_id, name, destination_url, weight, status")
        .in("step_id", stepIds)
        .order("created_at")).data ?? []
    : [];

  return { funnel, steps: steps ?? [], variants };
}

export default async function EditFunnelPage({ params }: { params: { slug: string } }) {
  const data = await getData(params.slug);
  if (!data) notFound();
  return (
    <Shell>
      <Builder funnel={data.funnel as any} initialSteps={data.steps as any} initialVariants={data.variants as any} />
    </Shell>
  );
}
