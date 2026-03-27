import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { client, period_from, period_to } = await req.json();

    if (!client || !period_from || !period_to) {
      return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch tracked products
    const { data: tracked } = await supabase
      .from("tracked_products")
      .select("product_id, product_name, gateway")
      .eq("client_slug", client)
      .eq("active", true);

    if (!tracked?.length) {
      return NextResponse.json({ error: "Nenhum produto rastreado." }, { status: 400 });
    }

    const ids = tracked.map((p: any) => p.product_id);

    // Fetch sales for the period
    const { data: sales } = await supabase
      .from("sales")
      .select("id, created_at, gateway, sale_type, amount, status, product_name, product_id, utm_medium, utm_campaign, utm_source, payment_method")
      .eq("client_slug", client)
      .in("product_id", ids)
      .gte("created_at", period_from)
      .lte("created_at", period_to);

    const rows = sales ?? [];
    const approved = rows.filter((s: any) => s.status === "approved");
    const refunded = rows.filter((s: any) => s.status === "refunded" || s.status === "chargeback");
    const mainSales = approved.filter((s: any) => s.sale_type === "main");
    const obSales = approved.filter((s: any) => s.sale_type === "order_bump");

    const revenue = mainSales.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    const obRevenue = obSales.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    const refundAmt = refunded.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    const avgTicket = mainSales.length > 0 ? revenue / mainSales.length : 0;
    const refundRate = (mainSales.length + refunded.length) > 0
      ? (refunded.length / (mainSales.length + refunded.length)) * 100 : 0;

    // Top products
    const prodMap = new Map<string, { name: string; sales: number; revenue: number }>();
    for (const s of mainSales) {
      const key = s.product_id ?? "unknown";
      const name = s.product_name ?? tracked.find((t: any) => t.product_id === key)?.product_name ?? key;
      const e = prodMap.get(key) ?? { name, sales: 0, revenue: 0 };
      e.sales++;
      e.revenue += Number(s.amount);
      prodMap.set(key, e);
    }
    const topProducts = Array.from(prodMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // Top campaigns
    const campMap = new Map<string, { sales: number; revenue: number }>();
    for (const s of mainSales) {
      const key = s.utm_campaign ?? s.utm_medium ?? "Orgânico/Direto";
      const e = campMap.get(key) ?? { sales: 0, revenue: 0 };
      e.sales++;
      e.revenue += Number(s.amount);
      campMap.set(key, e);
    }
    const topCampaigns = Array.from(campMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Sales by day of week
    const dayMap = new Map<number, number>();
    for (const s of mainSales) {
      const d = new Date(s.created_at).getDay();
      dayMap.set(d, (dayMap.get(d) ?? 0) + 1);
    }
    const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const byDay = dayLabels.map((label, i) => ({ label, vendas: dayMap.get(i) ?? 0 }));
    const bestDay = byDay.reduce((a, b) => (a.vendas >= b.vendas ? a : b));

    // Payment methods
    const pmMap = new Map<string, number>();
    for (const s of mainSales) {
      const pm = s.payment_method ?? "desconhecido";
      pmMap.set(pm, (pmMap.get(pm) ?? 0) + 1);
    }
    const topPayment = Array.from(pmMap.entries()).sort((a, b) => b[1] - a[1])[0];

    // Build context for Claude
    const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const context = `
Período analisado: ${new Date(period_from).toLocaleDateString("pt-BR")} a ${new Date(period_to).toLocaleDateString("pt-BR")}

MÉTRICAS GERAIS:
- Faturamento principal: R$ ${fmt(revenue)}
- Receita de Order Bumps: R$ ${fmt(obRevenue)}
- Total de vendas principais: ${mainSales.length}
- Order Bumps vendidos: ${obSales.length}
- Reembolsos: ${refunded.length} (R$ ${fmt(refundAmt)})
- Taxa de reembolso: ${refundRate.toFixed(2)}%
- Ticket médio: R$ ${fmt(avgTicket)}

TOP PRODUTOS (por faturamento):
${topProducts.map((p, i) => `${i + 1}. ${p.name} — ${p.sales} vendas — R$ ${fmt(p.revenue)}`).join("\n")}

TOP CAMPANHAS/ORIGENS:
${topCampaigns.map((c, i) => `${i + 1}. ${c.name} — ${c.sales} vendas — R$ ${fmt(c.revenue)}`).join("\n")}

VENDAS POR DIA DA SEMANA:
${byDay.map(d => `${d.label}: ${d.vendas} vendas`).join(" | ")}
Melhor dia: ${bestDay.label} (${bestDay.vendas} vendas)

${topPayment ? `MÉTODO DE PAGAMENTO MAIS USADO: ${topPayment[0]} (${topPayment[1]} vendas)` : ""}
    `.trim();

    // Call Claude API
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada no servidor." }, { status: 500 });
    }

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        messages: [
          {
            role: "user",
            content: `Você é um especialista em marketing digital e performance de vendas online. Analise os dados abaixo de um negócio de infoprodutos e forneça insights acionáveis em português brasileiro.

${context}

Por favor, forneça:
1. **Resumo executivo** (2-3 frases sobre o desempenho geral)
2. **Pontos positivos** (2-3 destaques)
3. **Pontos de atenção** (2-3 alertas ou oportunidades de melhoria)
4. **Recomendações** (3-4 ações concretas para a próxima semana)

Seja direto, objetivo e use linguagem de negócios. Não repita os números brutos desnecessariamente — foque nos insights.`,
          },
        ],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return NextResponse.json({ error: `Erro na API Claude: ${err}` }, { status: 500 });
    }

    const claudeData = await claudeRes.json();
    const analysis = claudeData.content?.[0]?.text ?? "Sem resposta.";

    return NextResponse.json({ analysis, context });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erro interno." }, { status: 500 });
  }
}
