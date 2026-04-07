import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function POST(req: NextRequest) {
  try {
    const { client, period_from, period_to, followUp, previousAnalysis, context: previousContext, conversationHistory } = await req.json();

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada no servidor." }, { status: 500 });
    }

    // ── Follow-up mode ──────────────────────────────────────────────────────
    if (followUp && previousAnalysis && previousContext) {
      const systemPrompt = `Você é um estrategista sênior de geração de leads (Meta Ads e Google Ads). Você acabou de gerar uma análise completa. O gestor está pedindo aprofundamento.

REGRAS:
- Responda diretamente à pergunta, sem repetir a análise anterior
- Use os dados do contexto para embasar sua resposta
- Seja específico e acionável
- Se o gestor fornecer contexto novo, incorpore na resposta`;

      const messages: { role: "user" | "assistant"; content: string }[] = [
        { role: "user", content: `DADOS DO PERÍODO:\n${previousContext}\n\nGere a análise completa.` },
        { role: "assistant", content: previousAnalysis },
        ...(conversationHistory ?? []),
        { role: "user", content: followUp },
      ];

      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2000, system: systemPrompt, messages }),
      });

      if (!claudeRes.ok) {
        const err = await claudeRes.text();
        return NextResponse.json({ error: `Erro na API Claude: ${err}` }, { status: 500 });
      }

      const claudeData = await claudeRes.json();
      return NextResponse.json({ reply: claudeData.content?.[0]?.text ?? "Sem resposta." });
    }

    if (!client || !period_from || !period_to) {
      return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
    }

    const supabase = createServiceClient();

    // ── 1. Leads no período ──────────────────────────────────────────────────
    const { data: leadsRaw } = await supabase
      .from("leads")
      .select("id, converted_at, source, lead_email, lead_name, conversion_event, utm_source, utm_medium, utm_campaign, utm_content, utm_term")
      .eq("client_slug", client)
      .not("utm_medium", "is", null)
      .gte("converted_at", period_from)
      .lte("converted_at", period_to);

    const leads = leadsRaw ?? [];

    if (leads.length === 0) {
      return NextResponse.json({ error: "Nenhum lead encontrado no período selecionado." }, { status: 400 });
    }

    // Leads por formulário
    const formMap = new Map<string, number>();
    for (const l of leads) {
      const key = l.conversion_event ?? "desconhecido";
      formMap.set(key, (formMap.get(key) ?? 0) + 1);
    }
    const topForms = Array.from(formMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Leads por UTM source
    const srcMap = new Map<string, number>();
    for (const l of leads) {
      const key = l.utm_source ?? "direto";
      srcMap.set(key, (srcMap.get(key) ?? 0) + 1);
    }

    // Leads por UTM medium (campanha)
    const campLeads = new Map<string, number>();
    for (const l of leads) {
      if (l.utm_campaign) campLeads.set(l.utm_campaign, (campLeads.get(l.utm_campaign) ?? 0) + 1);
    }

    // ── 2. Ad Campaigns ──────────────────────────────────────────────────────
    const { data: adCampaigns } = await supabase
      .from("ad_campaigns")
      .select("campaign_id, campaign_name, platform, impressions, clicks, spend, reach")
      .eq("client_slug", client)
      .gte("date", period_from.slice(0, 10))
      .lte("date", period_to.slice(0, 10));

    const campAgg = new Map<string, {
      name: string; platform: string; spend: number;
      impressions: number; clicks: number; reach: number; leads: number;
    }>();

    for (const c of (adCampaigns ?? [])) {
      const key = c.campaign_name;
      const e = campAgg.get(key) ?? { name: c.campaign_name, platform: c.platform, spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0 };
      e.spend += Number(c.spend);
      e.impressions += Number(c.impressions);
      e.clicks += Number(c.clicks);
      e.reach += Number(c.reach);
      campAgg.set(key, e);
    }

    for (const [campName, count] of Array.from(campLeads.entries())) {
      for (const [key, e] of Array.from(campAgg.entries())) {
        if (key === campName || key.includes(campName) || campName.includes(key)) {
          e.leads += count;
          break;
        }
      }
    }

    const campaignRows = Array.from(campAgg.values())
      .map(c => ({
        ...c,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        cpl: c.leads > 0 ? c.spend / c.leads : null,
        cpc: c.clicks > 0 ? c.spend / c.clicks : null,
      }))
      .sort((a, b) => (a.cpl ?? 9999) - (b.cpl ?? 9999));

    const hasAdData = campaignRows.length > 0;
    const totalSpend = campaignRows.reduce((s, c) => s + c.spend, 0);
    const overallCpl = leads.length > 0 && totalSpend > 0 ? totalSpend / leads.length : 0;

    // ── 3. Ad Creatives ──────────────────────────────────────────────────────
    const { data: adCreatives } = await supabase
      .from("ad_creatives")
      .select("ad_id, ad_name, campaign_name, platform, creative_type, headline, body, impressions, clicks, spend")
      .eq("client_slug", client)
      .gte("date", period_from.slice(0, 10))
      .lte("date", period_to.slice(0, 10));

    const creativeAgg = new Map<string, {
      name: string; campaign: string; platform: string; type: string | null;
      headline: string | null; body: string | null;
      spend: number; impressions: number; clicks: number; leads: number;
    }>();

    for (const c of (adCreatives ?? [])) {
      const key = c.ad_id;
      const e = creativeAgg.get(key) ?? {
        name: c.ad_name, campaign: c.campaign_name ?? "", platform: c.platform,
        type: c.creative_type, headline: c.headline, body: c.body,
        spend: 0, impressions: 0, clicks: 0, leads: 0,
      };
      e.spend += Number(c.spend);
      e.impressions += Number(c.impressions);
      e.clicks += Number(c.clicks);
      creativeAgg.set(key, e);
    }

    for (const l of leads) {
      const adName = l.utm_term;
      if (adName) {
        for (const [, e] of Array.from(creativeAgg.entries())) {
          if (e.name === adName || e.name.includes(adName) || adName.includes(e.name)) {
            e.leads++;
            break;
          }
        }
      }
    }

    const creativeRows = Array.from(creativeAgg.values())
      .map(c => ({
        ...c,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        cpl: c.leads > 0 ? c.spend / c.leads : null,
      }))
      .sort((a, b) => (a.cpl ?? 9999) - (b.cpl ?? 9999));

    const topCreatives = creativeRows.slice(0, 8);
    const worstCreatives = creativeRows.filter(c => c.spend > 0 && c.leads === 0).slice(-3);

    // ── 4. Build Claude context ──────────────────────────────────────────────
    const periodLabel = `${new Date(period_from).toLocaleDateString("pt-BR")} a ${new Date(period_to).toLocaleDateString("pt-BR")}`;

    const leadsContext = `
LEADS — ${periodLabel}
- Total de leads: ${leads.length}
- CPL geral: ${overallCpl > 0 ? `R$ ${fmt(overallCpl)}` : "sem dados de gasto"}
- Investimento total: ${totalSpend > 0 ? `R$ ${fmt(totalSpend)}` : "sem dados"}
- Formulários/eventos: ${topForms.map(([f, n]) => `${f} (${n})`).join(", ")}
- Origens (utm_source): ${Array.from(srcMap.entries()).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s}: ${n}`).join(", ")}
`.trim();

    const campaignContext = hasAdData ? `
CAMPANHAS DE ANÚNCIOS:
${campaignRows.map(c => {
  const parts = [
    `  • [${c.platform.toUpperCase()}] ${c.name}`,
    `    Gasto: R$${fmt(c.spend)} · Impressões: ${c.impressions.toLocaleString("pt-BR")} · Cliques: ${c.clicks.toLocaleString("pt-BR")} · CTR: ${c.ctr.toFixed(2)}%`,
    c.cpc ? `    CPC: R$${fmt(c.cpc)}` : "",
    c.leads > 0 ? `    Leads atribuídos: ${c.leads} · CPL: R$${fmt(c.cpl!)}` : "    Leads: 0 (sem UTM correspondente)",
  ].filter(Boolean);
  return parts.join("\n");
}).join("\n")}
`.trim() : "CAMPANHAS: dados ainda não integrados (Meta/Google API pendente)";

    const creativesContext = topCreatives.length > 0 ? `
CRIATIVOS — TOP PERFORMERS:
${topCreatives.map((c, i) => {
  const parts = [
    `  ${i + 1}. [${c.type ?? "criativo"}] ${c.name} (${c.campaign})`,
    c.headline ? `     Headline: "${c.headline}"` : "",
    `     CTR: ${c.ctr.toFixed(2)}% · Gasto: R$${fmt(c.spend)}`,
    c.leads > 0 ? `     Leads: ${c.leads} · CPL: R$${fmt(c.cpl!)}` : "     Sem leads atribuídos",
  ].filter(Boolean);
  return parts.join("\n");
}).join("\n")}
${worstCreatives.length > 0 ? `\nCRIATIVOS SEM LEADS (com gasto):\n${worstCreatives.map(c => `  • ${c.name}: CTR ${c.ctr.toFixed(2)}%, Gasto R$${fmt(c.spend)}, 0 leads`).join("\n")}` : ""}
`.trim() : "CRIATIVOS: dados ainda não integrados";

    const fullContext = [leadsContext, campaignContext, creativesContext].filter(Boolean).join("\n\n");

    // ── 5. Build Claude prompt ───────────────────────────────────────────────
    const systemPrompt = `Você é um estrategista sênior de geração de leads via mídia paga (Meta Ads e Google Ads). Sua função é transformar dados brutos em diagnósticos precisos e recomendações acionáveis — não em resumos descritivos.

REGRAS OBRIGATÓRIAS:
- NUNCA repita os números brutos que já estão nos dados. O gestor já os conhece.
- SEMPRE interprete o que os números significam: o que está bom, o que está ruim, por quê.
- SEMPRE termine cada seção com uma conclusão clara ou ação recomendada.
- Use linguagem direta de gestor de tráfego, sem enrolação.
- Foco em CPL, volume de leads, taxa de conversão — NÃO existe venda neste contexto.`;

    const userPrompt = `Analise os dados de performance de geração de leads abaixo e gere um diagnóstico estratégico completo.

DADOS DO PERÍODO:
${fullContext}

Responda EXATAMENTE neste formato (sem introdução, sem conclusão geral, só as 6 seções):

**1. Resumo Executivo**
Em 2-3 frases: qual foi o resultado do período em geração de leads? O CPL está saudável? O volume está escalando?

**2. Diagnóstico de Campanhas**
${hasAdData
  ? "Para cada campanha: veredicto (escalar / manter / pausar) + justificativa em 1 linha baseada no CPL e volume de leads. Qual campanha está puxando leads baratos e qual está drenando budget?"
  : "Com base nos UTMs dos leads, identifique de quais campanhas vieram os leads. Qual origem converte melhor?"}

**3. Análise de Criativos**
${topCreatives.length > 0
  ? "Qual padrão une os criativos que geram leads? (formato, abordagem, tema). Qual está gastando sem gerar leads? Cite nomes."
  : "Com base nos utm_content, identifique quais anúncios geraram leads e o que isso revela."}

**4. Sugestões de Novos Criativos**
Sugira exatamente 4 criativos para testar na próxima semana. Para cada um:
- Formato: [vídeo / imagem / carrossel]
- Headline: [texto exato da headline]
- Gancho: [primeira frase ou cena de abertura]
- Hipótese: por que esse criativo deve gerar leads com base nos dados

**5. Perfil do Lead Ideal**
Com base nos formulários, origens, UTMs e horários: quem é esse lead? Qual é a dor que o serviço/produto resolve? Como ele chegou até o formulário?

**6. Top 5 Ações para Esta Semana**
Liste 5 ações ordenadas por impacto, cada uma com:
- O que fazer (específico, não genérico)
- Por quê (baseado nos dados)
- Como medir o resultado`;

    // ── 6. Call Claude API ───────────────────────────────────────────────────
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 3000, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return NextResponse.json({ error: `Erro na API Claude: ${err}` }, { status: 500 });
    }

    const claudeData = await claudeRes.json();
    const analysis = claudeData.content?.[0]?.text ?? "Sem resposta.";

    return NextResponse.json({
      analysis,
      context: fullContext,
      dataSources: {
        hasLeads: leads.length > 0,
        hasCampaigns: hasAdData,
        hasCreatives: topCreatives.length > 0,
        hasAudience: false,
      },
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erro interno." }, { status: 500 });
  }
}
