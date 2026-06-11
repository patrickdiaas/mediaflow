import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * GET /api/funnels/:id/metrics — métricas agregadas por variante.
 * Lê da view variant_metrics (já agrega visitantes únicos, vendas e receita).
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("funis_variant_metrics")
    .select("*")
    .eq("funnel_id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Totais por funil
  const totals = (data ?? []).reduce(
    (acc, v: any) => {
      acc.visitors += Number(v.visitors) || 0;
      acc.sales    += Number(v.sales)    || 0;
      acc.revenue  += Number(v.revenue)  || 0;
      return acc;
    },
    { visitors: 0, sales: 0, revenue: 0 }
  );

  return NextResponse.json({ variants: data ?? [], totals });
}
