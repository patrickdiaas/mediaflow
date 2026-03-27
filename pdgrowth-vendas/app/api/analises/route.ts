import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Fetch audience data from Google Sheets ───────────────────────────────────
async function fetchAudienceInsights(
  client: string,
  productId: string,
  sheetId: string,
  salesEmails: Set<string>
): Promise<string> {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!apiKey) return "";

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:Z1000?key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return "";
    const { values } = await res.json() as { values?: string[][] };
    if (!values || values.length < 2) return "";

    const headers = values[0];
    const rows = values.slice(1).map(row =>
      Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""]))
    );

    const emailHeader = headers.find(h =>
      h.toLowerCase().includes("email") || h.toLowerCase().includes("e-mail")
    );
    if (!emailHeader) return "";

    const questionCols = headers.filter(h => {
      const l = h.toLowerCase();
      return !l.includes("email") && !l.includes("e-mail") &&
             !l.includes("timestamp") && !l.includes("carimbo") &&
             !l.includes("whatsapp") && !l.includes("telefone") &&
             !l.includes("celular") && !l.includes("phone");
    });

    const insights: string[] = [`Audiência (${rows.length} respostas, ${productId}):`];

    for (const col of questionCols) {
      const answerMap = new Map<string, { leads: number; vendas: number }>();
      for (const row of rows) {
        const answer = String(row[col] ?? "").trim();
        if (!answer) continue;
        const email = String(row[emailHeader] ?? "").toLowerCase().trim();
        const e = answerMap.get(answer) ?? { leads: 0, vendas: 0 };
        e.leads++;
        if (email && salesEmails.has(email)) e.vendas++;
        answerMap.set(answer, e);
      }

      const sorted = Array.from(answerMap.entries())
        .map(([ans, s]) => ({ ans, ...s, rate: s.leads > 0 ? (s.vendas / s.leads) * 100 : 0 }))
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 5);

      if (sorted.length === 0) continue;

      insights.push(`  Pergunta: "${col}"`);
      for (const a of sorted) {
        insights.push(`    • "${a.ans}": ${a.leads} leads, ${a.vendas} vendas, ${a.rate.toFixed(1)}% conv.`);
      }
    }

    return insights.join("\n");
  } catch {
    return "";
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { client, period_from, period_to } = await req.json();

    if (!client || !period_from || !period_to) {
      return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
    }

    const supabase = createServiceClient();

    // ── 1. Tracked products ──────────────────────────────────────────────────
    const { data: tracked } = await supabase
      .from("tracked_products")
      .select("product_id, product_name, gateway, sheet_id")
      .eq("client_slug", client)
      .eq("active", true);

    if (!tracked?.length) {
      return NextResponse.json({ error: "Nenhum produto rastreado." }, { status: 400 });
    }

    const productIds = tracked.map((p: any) => p.product_id);

    // ── 2. Sales data ────────────────────────────────────────────────────────
    const { data: salesRaw } = await supabase
      .from("sales")
      .select("id, created_at, sale_type, amount, status, product_name, product_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, payment_method, buyer_email")
      .eq("client_slug", client)
      .in("product_id", productIds)
      .gte("created_at", period_from)
      .lte("created_at", period_to);

    const sales = salesRaw ?? [];
    const approved = sales.filter((s: any) => s.status === "approved");
    const refunded = sales.filter((s: any) => s.status === "refunded" || s.status === "chargeback");
    const mainSales = approved.filter((s: any) => s.sale_type === "main");
    const obSales = approved.filter((s: any) => s.sale_type === "order_bump");

    const revenue = mainSales.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    const obRevenue = obSales.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    const refundAmt = refunded.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    const avgTicket = mainSales.length > 0 ? revenue / mainSales.length : 0;
    const refundRate = (mainSales.length + refunded.length) > 0
      ? (refunded.length / (mainSales.length + refunded.length)) * 100 : 0;

    const buyerEmails = new Set<string>(
      mainSales.map((s: any) => s.buyer_email?.toLowerCase()).filter(Boolean)
    );

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

    // Payment methods
    const pmMap = new Map<string, number>();
    for (const s of mainSales) {
      const pm = s.payment_method ?? "desconhecido";
      pmMap.set(pm, (pmMap.get(pm) ?? 0) + 1);
    }

    // ── 3. Ad Campaigns ──────────────────────────────────────────────────────
    const { data: adCampaigns } = await supabase
      .from("ad_campaigns")
      .select("campaign_id, campaign_name, platform, status, impressions, clicks, spend, reach")
      .eq("client_slug", client)
      .gte("date", period_from.slice(0, 10))
      .lte("date", period_to.slice(0, 10));

    // Aggregate campaign metrics + correlate sales by utm_medium
    const campAgg = new Map<string, {
      name: string; platform: string; spend: number;
      impressions: number; clicks: number; reach: number;
      salesCount: number; salesRevenue: number;
    }>();

    for (const c of (adCampaigns ?? [])) {
      const key = c.campaign_name;
      const e = campAgg.get(key) ?? { name: c.campaign_name, platform: c.platform, spend: 0, impressions: 0, clicks: 0, reach: 0, salesCount: 0, salesRevenue: 0 };
      e.spend += Number(c.spend);
      e.impressions += Number(c.impressions);
      e.clicks += Number(c.clicks);
      e.reach += Number(c.reach);
      campAgg.set(key, e);
    }

    // Match sales to campaigns via utm_medium
    for (const s of mainSales) {
      const campName = s.utm_medium;
      if (!campName) continue;
      // Try exact match or partial match
      for (const [key, e] of campAgg.entries()) {
        if (key === campName || key.includes(campName) || campName.includes(key)) {
          e.salesCount++;
          e.salesRevenue += Number(s.amount);
          break;
        }
      }
    }

    const campaignRows = Array.from(campAgg.values())
      .map(c => ({
        ...c,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        cpa: c.salesCount > 0 ? c.spend / c.salesCount : null,
        roas: c.spend > 0 ? c.salesRevenue / c.spend : null,
        cpc: c.clicks > 0 ? c.spend / c.clicks : null,
      }))
      .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0));

    const hasAdData = campaignRows.length > 0;

    // ── 4. Ad Creatives ──────────────────────────────────────────────────────
    const { data: adCreatives } = await supabase
      .from("ad_creatives")
      .select("ad_id, ad_name, campaign_name, platform, creative_type, headline, body, impressions, clicks, spend, reach")
      .eq("client_slug", client)
      .gte("date", period_from.slice(0, 10))
      .lte("date", period_to.slice(0, 10));

    // Aggregate creative metrics
    const creativeAgg = new Map<string, {
      name: string; campaign: string; platform: string; type: string | null;
      headline: string | null; body: string | null;
      spend: number; impressions: number; clicks: number;
      salesCount: number; salesRevenue: number;
    }>();

    for (const c of (adCreatives ?? [])) {
      const key = c.ad_id;
      const e = creativeAgg.get(key) ?? {
        name: c.ad_name, campaign: c.campaign_name ?? "", platform: c.platform,
        type: c.creative_type, headline: c.headline, body: c.body,
        spend: 0, impressions: 0, clicks: 0, salesCount: 0, salesRevenue: 0,
      };
      e.spend += Number(c.spend);
      e.impressions += Number(c.impressions);
      e.clicks += Number(c.clicks);
      creativeAgg.set(key, e);
    }

    // Match sales to creatives via utm_content (ad name) or utm_term (ad id)
    for (const s of mainSales) {
      const adName = s.utm_content;
      const adId = s.utm_term;
      if (adId && creativeAgg.has(adId)) {
        const e = creativeAgg.get(adId)!;
        e.salesCount++;
        e.salesRevenue += Number(s.amount);
      } else if (adName) {
        for (const [, e] of creativeAgg.entries()) {
          if (e.name === adName || e.name.includes(adName) || adName.includes(e.name)) {
            e.salesCount++;
            e.salesRevenue += Number(s.amount);
            break;
          }
        }
      }
    }

    const creativeRows = Array.from(creativeAgg.values())
      .map(c => ({
        ...c,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        cpa: c.salesCount > 0 ? c.spend / c.salesCount : null,
        roas: c.spend > 0 ? c.salesRevenue / c.spend : null,
      }))
      .sort((a, b) => (b.roas ?? b.ctr) - (a.roas ?? a.ctr));

    const topCreatives = creativeRows.slice(0, 8);
    const worstCreatives = creativeRows.filter(c => c.spend > 0).slice(-3);

    // ── 5. Audience data from Google Sheets ──────────────────────────────────
    const productsWithSheets = tracked.filter((p: any) => p.sheet_id);
    const audienceParts: string[] = [];

    for (const p of productsWithSheets) {
      const part = await fetchAudienceInsights(client, p.product_id, p.sheet_id, buyerEmails);
      if (part) audienceParts.push(part);
    }

    // ── 6. Build Claude context ───────────────────────────────────────────────
    const periodLabel = `${new Date(period_from).toLocaleDateString("pt-BR")} a ${new Date(period_to).toLocaleDateString("pt-BR")}`;

    const salesContext = `
VENDAS — ${periodLabel}
- Faturamento principal: R$ ${fmt(revenue)} (${mainSales.length} vendas)
- Order Bumps: ${obSales.length} vendas · R$ ${fmt(obRevenue)} (taxa: ${mainSales.length > 0 ? ((obSales.length / mainSales.length) * 100).toFixed(1) : 0}% dos compradores)
- Reembolsos: ${refunded.length} · R$ ${fmt(refundAmt)} · taxa ${refundRate.toFixed(2)}%
- Ticket médio: R$ ${fmt(avgTicket)}
- Top produtos: ${topProducts.map(p => `${p.name} (${p.sales}v · R$${fmt(p.revenue)})`).join(", ")}
- Métodos de pagamento: ${Array.from(pmMap.entries()).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m}: ${n}`).join(", ")}
`.trim();

    const campaignContext = hasAdData ? `
CAMPANHAS DE ANÚNCIOS:
${campaignRows.map(c => {
  const parts = [
    `  • [${c.platform.toUpperCase()}] ${c.name}`,
    `    Gasto: R$${fmt(c.spend)}`,
    `    Impressões: ${c.impressions.toLocaleString("pt-BR")} · Cliques: ${c.clicks.toLocaleString("pt-BR")} · CTR: ${c.ctr.toFixed(2)}%`,
    c.cpc ? `    CPC: R$${fmt(c.cpc)}` : "",
    c.salesCount > 0 ? `    Vendas atribuídas: ${c.salesCount} · Receita: R$${fmt(c.salesRevenue)} · ROAS: ${c.roas?.toFixed(2)}x · CPA: R$${fmt(c.cpa!)}` : "    Vendas atribuídas: 0 (sem UTM correspondente)",
  ].filter(Boolean);
  return parts.join("\n");
}).join("\n")}
`.trim() : "CAMPANHAS DE ANÚNCIOS: dados ainda não integrados (Meta/Google API pendente)";

    const creativesContext = topCreatives.length > 0 ? `
CRIATIVOS — TOP PERFORMERS:
${topCreatives.map((c, i) => {
  const parts = [
    `  ${i + 1}. [${c.type ?? "criativo"}] ${c.name} (${c.campaign})`,
    c.headline ? `     Headline: "${c.headline}"` : "",
    c.body ? `     Texto: "${c.body.slice(0, 120)}${c.body.length > 120 ? "..." : ""}"` : "",
    `     CTR: ${c.ctr.toFixed(2)}% · Gasto: R$${fmt(c.spend)}`,
    c.salesCount > 0 ? `     Vendas: ${c.salesCount} · ROAS: ${c.roas?.toFixed(2)}x · CPA: R$${fmt(c.cpa!)}` : "     Sem vendas atribuídas",
  ].filter(Boolean);
  return parts.join("\n");
}).join("\n")}
${worstCreatives.length > 0 ? `\nCRIATIVOS — PIORES PERFORMERS (com gasto):\n${worstCreatives.map(c => `  • ${c.name}: CTR ${c.ctr.toFixed(2)}%, ROAS ${c.roas?.toFixed(2) ?? "—"}x, Gasto R$${fmt(c.spend)}`).join("\n")}` : ""}
`.trim() : "CRIATIVOS: dados ainda não integrados (Meta/Google API pendente)";

    const audienceContext = audienceParts.length > 0
      ? `\nAUDIÊNCIA — PERFIL DO COMPRADOR (Google Sheets):\n${audienceParts.join("\n\n")}`
      : "";

    const fullContext = [salesContext, campaignContext, creativesContext, audienceContext].filter(Boolean).join("\n\n");

    // ── 7. Build Claude prompt ────────────────────────────────────────────────
    const prompt = `Você é um especialista sênior em marketing digital e performance de anúncios (Meta Ads e Google Ads) para infoprodutos brasileiros. Analise os dados abaixo e forneça uma análise completa e acionável.

${fullContext}

Estruture sua resposta exatamente com estas seções (use os títulos em negrito):

**1. Resumo Executivo**
(2-3 frases sobre o desempenho geral do período)

**2. Diagnóstico de Campanhas**
${hasAdData ? "Analise ROAS, CPA, CTR e gasto de cada campanha. Identifique quais escalar, pausar ou otimizar. Seja específico com os números." : "Dados de campanhas ainda não integrados. Comente o que as UTMs das vendas revelam sobre as origens."}

**3. Análise de Criativos**
${topCreatives.length > 0 ? "Identifique padrões nos top performers (tipo, headline, abordagem). Aponte o que está drenando budget sem retorno." : "Dados de criativos ainda não integrados. Comente o que utm_content das vendas revela."}

**4. Sugestões de Novos Criativos**
Baseado nos dados disponíveis, sugira 4 criativos concretos para testar. Para cada um especifique: tipo (vídeo/imagem/carrossel), headline, gancho principal, e por que deve performar bem. Seja específico ao nicho dos produtos.

**5. Perfil do Comprador Ideal**
${audienceParts.length > 0 ? "Baseado nas respostas da audiência, descreva o perfil do comprador que mais converte. Identifique a dor principal e o motivador de compra." : "Sem dados de audiência disponíveis. Infira o perfil com base nos padrões de UTM e produtos."}

**6. Recomendações Prioritárias**
Liste 4-5 ações específicas ordenadas por impacto esperado. Cada ação deve ter um próximo passo concreto.

Seja direto, use linguagem de negócios, evite jargões desnecessários. Foque em insights que um gestor de tráfego possa executar amanhã.`;

    // ── 8. Call Claude API ────────────────────────────────────────────────────
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
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return NextResponse.json({ error: `Erro na API Claude: ${err}` }, { status: 500 });
    }

    const claudeData = await claudeRes.json();
    const analysis = claudeData.content?.[0]?.text ?? "Sem resposta.";

    const dataSources = {
      hasSales: mainSales.length > 0,
      hasCampaigns: hasAdData,
      hasCreatives: topCreatives.length > 0,
      hasAudience: audienceParts.length > 0,
    };

    return NextResponse.json({ analysis, context: fullContext, dataSources });

  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erro interno." }, { status: 500 });
  }
}
