import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const maxDuration = 300; // 5 min — Vercel Pro

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function extractWords(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(w => w.length > 1);
}
function fuzzyMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const al = a.toLowerCase(), bl = b.toLowerCase();
  if (al.includes(bl) || bl.includes(al)) return true;
  const aWords = extractWords(a);
  const bWords = extractWords(b);
  if (aWords.length === 0 || bWords.length === 0) return false;
  const [smaller, larger] = aWords.length <= bWords.length ? [aWords, bWords] : [bWords, aWords];
  return smaller.length >= 1 && smaller.every(w => larger.includes(w));
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
      const systemPrompt = `Você é um estrategista sênior de geração de leads via Meta Ads e Google Ads. Você acabou de gerar uma análise completa. O gestor está pedindo aprofundamento.

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
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 3000, system: systemPrompt, messages }),
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
    const dateSince = period_from.slice(0, 10);
    const dateUntil = period_to.slice(0, 10);

    // BRT adjustment for leads
    const leadSince = `${dateSince}T03:00:00`;
    const untilDate = new Date(dateUntil + "T00:00:00Z");
    untilDate.setUTCDate(untilDate.getUTCDate() + 1);
    const leadUntil = `${untilDate.toISOString().split("T")[0]}T02:59:59`;

    // ── 1. Leads no período ──────────────────────────────────────────────────
    const { data: leadsRaw } = await supabase
      .from("leads")
      .select("id, converted_at, source, lead_email, lead_name, conversion_event, utm_source, utm_medium, utm_campaign, utm_content, utm_term")
      .eq("client_slug", client)
      .not("utm_medium", "is", null)
      .not("utm_medium", "in", '(organic,"(none)",unknown,referral)')
      .gte("converted_at", leadSince)
      .lte("converted_at", leadUntil);

    const leads = leadsRaw ?? [];

    if (leads.length === 0) {
      return NextResponse.json({ error: "Nenhum lead encontrado no período selecionado." }, { status: 400 });
    }

    // Leads por plataforma
    const metaLeads = leads.filter(l => {
      const src = (l.utm_source ?? "").toLowerCase();
      return src === "facebook" || src === "fb" || src === "instagram" || src === "ig" || src === "facebook ads";
    });
    const googleLeads = leads.filter(l => (l.utm_source ?? "").toLowerCase() === "google");

    // Leads por formulário
    const formMap = new Map<string, number>();
    for (const l of leads) {
      const key = l.conversion_event ?? "desconhecido";
      formMap.set(key, (formMap.get(key) ?? 0) + 1);
    }
    const topForms = Array.from(formMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // Leads por UTM campaign
    const campLeads = new Map<string, number>();
    for (const l of leads) {
      if (l.utm_campaign) campLeads.set(l.utm_campaign, (campLeads.get(l.utm_campaign) ?? 0) + 1);
    }

    // ── 2. Ad Campaigns (Meta + Google) ──────────────────────────────────────
    const { data: adCampaigns } = await supabase
      .from("ad_campaigns")
      .select("campaign_id, campaign_name, platform, status, impressions, clicks, spend, reach, landing_page_views, lead_form_submissions")
      .eq("client_slug", client)
      .gte("date", dateSince)
      .lte("date", dateUntil);

    const campAgg = new Map<string, {
      name: string; platform: string; campaignIds: Set<string>; status: string;
      spend: number; impressions: number; clicks: number; reach: number;
      lpv: number; lfs: number; leads: number;
    }>();

    for (const c of (adCampaigns ?? [])) {
      const key = c.campaign_name;
      const e = campAgg.get(key) ?? { name: c.campaign_name, platform: c.platform, campaignIds: new Set(), status: c.status ?? "", spend: 0, impressions: 0, clicks: 0, reach: 0, lpv: 0, lfs: 0, leads: 0 };
      e.spend += Number(c.spend); e.impressions += Number(c.impressions); e.clicks += Number(c.clicks); e.reach += Number(c.reach);
      e.lpv += Number(c.landing_page_views ?? 0); e.lfs += Number(c.lead_form_submissions ?? 0);
      if (c.campaign_id) e.campaignIds.add(c.campaign_id);
      campAgg.set(key, e);
    }

    // Atribuir leads a campanhas (mesmo algoritmo do overview)
    const campNames = Array.from(campAgg.keys());
    const campIdToName = new Map<string, string>();
    for (const [name, data] of Array.from(campAgg.entries())) {
      for (const cid of Array.from(data.campaignIds)) campIdToName.set(cid, name);
    }
    for (const l of leads) {
      if (!l.utm_campaign) continue;
      const utmCamp = l.utm_campaign;
      const exact = campNames.find(n => n === utmCamp);
      if (exact) { const c = campAgg.get(exact)!; c.leads++; continue; }
      const byId = campIdToName.get(utmCamp);
      if (byId) { const c = campAgg.get(byId)!; c.leads++; continue; }
      const fuzzy = campNames.find(n => fuzzyMatch(n, utmCamp));
      if (fuzzy) { const c = campAgg.get(fuzzy)!; c.leads++; }
    }

    const campaignRows = Array.from(campAgg.values())
      .map(c => ({
        ...c,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        cpl: c.leads > 0 ? c.spend / c.leads : null,
        cpc: c.clicks > 0 ? c.spend / c.clicks : null,
      }))
      .sort((a, b) => (b.leads || 0) - (a.leads || 0));

    const metaCampaigns = campaignRows.filter(c => c.platform === "meta");
    const googleCampaigns = campaignRows.filter(c => c.platform === "google");
    const totalSpend = campaignRows.reduce((s, c) => s + c.spend, 0);
    const overallCpl = leads.length > 0 && totalSpend > 0 ? totalSpend / leads.length : 0;

    // ── 3. Ad Creatives ──────────────────────────────────────────────────────
    const { data: adCreatives } = await supabase
      .from("ad_creatives")
      .select("ad_id, ad_name, campaign_name, platform, creative_type, headline, body, impressions, clicks, spend")
      .eq("client_slug", client)
      .gte("date", dateSince)
      .lte("date", dateUntil);

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
      e.spend += Number(c.spend); e.impressions += Number(c.impressions); e.clicks += Number(c.clicks);
      creativeAgg.set(key, e);
    }

    for (const l of leads) {
      const adName = l.utm_term;
      if (adName) {
        for (const [, e] of Array.from(creativeAgg.entries())) {
          if (e.name === adName || fuzzyMatch(e.name, adName)) { e.leads++; break; }
        }
      }
    }

    const creativeRows = Array.from(creativeAgg.values())
      .map(c => ({ ...c, ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0, cpl: c.leads > 0 ? c.spend / c.leads : null }))
      .sort((a, b) => (b.leads || 0) - (a.leads || 0));

    const topCreatives = creativeRows.filter(c => c.leads > 0).slice(0, 8);
    const worstCreatives = creativeRows.filter(c => c.spend > 50 && c.leads === 0).slice(0, 5);

    // ── 4. Placements (Meta) ─────────────────────────────────────────────────
    const { data: placements } = await supabase
      .from("ad_placements")
      .select("placement, impressions, clicks, spend, conversions")
      .eq("client_slug", client)
      .gte("date", dateSince)
      .lte("date", dateUntil);

    const plcAgg = new Map<string, { impressions: number; clicks: number; spend: number; conversions: number }>();
    for (const p of (placements ?? [])) {
      const e = plcAgg.get(p.placement) ?? { impressions: 0, clicks: 0, spend: 0, conversions: 0 };
      e.impressions += Number(p.impressions); e.clicks += Number(p.clicks);
      e.spend += Number(p.spend); e.conversions += Number(p.conversions ?? 0);
      plcAgg.set(p.placement, e);
    }
    const topPlacements = Array.from(plcAgg.entries())
      .map(([name, v]) => ({ name, ...v, ctr: v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0 }))
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 8);

    // ── 5. Keywords (Google) ─────────────────────────────────────────────────
    const { data: keywords } = await supabase
      .from("keywords")
      .select("keyword_text, campaign_name, match_type, impressions, clicks, spend, conversions")
      .eq("client_slug", client)
      .gte("date", dateSince)
      .lte("date", dateUntil);

    const kwAgg = new Map<string, { campaign: string; matchType: string; impressions: number; clicks: number; spend: number; conversions: number }>();
    for (const k of (keywords ?? [])) {
      if (!k.keyword_text) continue;
      const key = k.keyword_text;
      const e = kwAgg.get(key) ?? { campaign: k.campaign_name ?? "", matchType: k.match_type ?? "", impressions: 0, clicks: 0, spend: 0, conversions: 0 };
      e.impressions += Number(k.impressions); e.clicks += Number(k.clicks);
      e.spend += Number(k.spend ?? 0); e.conversions += Number(k.conversions ?? 0);
      kwAgg.set(key, e);
    }
    const topKeywords = Array.from(kwAgg.entries())
      .map(([text, v]) => ({ text, ...v, cpc: v.clicks > 0 ? v.spend / v.clicks : 0 }))
      .sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks)
      .slice(0, 15);

    // ── 6. Search Terms (Google) ─────────────────────────────────────────────
    const { data: searchTerms } = await supabase
      .from("search_terms")
      .select("search_term, campaign_name, impressions, clicks, spend, conversions")
      .eq("client_slug", client)
      .gte("date", dateSince)
      .lte("date", dateUntil);

    const stAgg = new Map<string, { campaign: string; impressions: number; clicks: number; spend: number; conversions: number }>();
    for (const s of (searchTerms ?? [])) {
      if (!s.search_term) continue;
      const key = s.search_term;
      const e = stAgg.get(key) ?? { campaign: s.campaign_name ?? "", impressions: 0, clicks: 0, spend: 0, conversions: 0 };
      e.impressions += Number(s.impressions); e.clicks += Number(s.clicks);
      e.spend += Number(s.spend ?? 0); e.conversions += Number(s.conversions ?? 0);
      stAgg.set(key, e);
    }
    const topSearchTerms = Array.from(stAgg.entries())
      .map(([term, v]) => ({ term, ...v }))
      .sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks)
      .slice(0, 15);

    // ── 7. Formulários por campanha ──────────────────────────────────────────
    const formsByCampaign = new Map<string, Map<string, number>>();
    for (const l of leads) {
      const camp = l.utm_campaign ?? "(sem campanha)";
      const form = l.conversion_event ?? "desconhecido";
      if (!formsByCampaign.has(camp)) formsByCampaign.set(camp, new Map());
      const fMap = formsByCampaign.get(camp)!;
      fMap.set(form, (fMap.get(form) ?? 0) + 1);
    }

    // ── 8. Build Claude context ──────────────────────────────────────────────
    const periodLabel = `${new Date(period_from).toLocaleDateString("pt-BR")} a ${new Date(period_to).toLocaleDateString("pt-BR")}`;

    const summaryContext = `
RESUMO GERAL — ${periodLabel}
- Total de leads (com UTM): ${leads.length}
  • Meta Ads: ${metaLeads.length} leads
  • Google Ads: ${googleLeads.length} leads
- Investimento total: R$ ${fmt(totalSpend)}
- CPL geral: ${overallCpl > 0 ? `R$ ${fmt(overallCpl)}` : "sem dados"}
- Formulários: ${topForms.map(([f, n]) => `${f} (${n})`).join(", ")}
`.trim();

    const metaContext = metaCampaigns.length > 0 ? `
META ADS — CAMPANHAS:
${metaCampaigns.map(c => {
  return `  • ${c.name} | Gasto: R$${fmt(c.spend)} | Impr: ${c.impressions.toLocaleString("pt-BR")} | Cliques: ${c.clicks.toLocaleString("pt-BR")} | CTR: ${c.ctr.toFixed(2)}% | Leads: ${c.leads}${c.cpl ? ` | CPL: R$${fmt(c.cpl)}` : ""}`;
}).join("\n")}
`.trim() : "";

    const googleContext = googleCampaigns.length > 0 ? `
GOOGLE ADS — CAMPANHAS:
${googleCampaigns.map(c => {
  return `  • ${c.name} | Gasto: R$${fmt(c.spend)} | Impr: ${c.impressions.toLocaleString("pt-BR")} | Cliques: ${c.clicks.toLocaleString("pt-BR")} | CTR: ${c.ctr.toFixed(2)}%${c.cpc ? ` | CPC: R$${fmt(c.cpc)}` : ""} | Leads: ${c.leads}${c.cpl ? ` | CPL: R$${fmt(c.cpl)}` : ""}`;
}).join("\n")}
`.trim() : "";

    const keywordsContext = topKeywords.length > 0 ? `
GOOGLE ADS — TOP PALAVRAS-CHAVE:
${topKeywords.map((k, i) => {
  return `  ${i + 1}. "${k.text}" [${k.matchType}] (${k.campaign}) | Cliques: ${k.clicks} | CPC: R$${k.cpc.toFixed(2)} | Conv: ${k.conversions.toFixed(0)} | Gasto: R$${fmt(k.spend)}`;
}).join("\n")}
`.trim() : "";

    const searchTermsContext = topSearchTerms.length > 0 ? `
GOOGLE ADS — TOP TERMOS DE PESQUISA:
${topSearchTerms.map((s, i) => {
  return `  ${i + 1}. "${s.term}" (${s.campaign}) | Cliques: ${s.clicks} | Conv: ${s.conversions.toFixed(0)} | Gasto: R$${fmt(s.spend)}`;
}).join("\n")}
`.trim() : "";

    const placementsContext = topPlacements.length > 0 ? `
META ADS — POSICIONAMENTOS:
${topPlacements.map(p => {
  return `  • ${p.name} | Conversões: ${p.conversions} | Cliques: ${p.clicks.toLocaleString("pt-BR")} | CTR: ${p.ctr.toFixed(2)}% | Gasto: R$${fmt(p.spend)}`;
}).join("\n")}
`.trim() : "";

    const creativesContext = topCreatives.length > 0 ? `
CRIATIVOS — TOP PERFORMERS:
${topCreatives.map((c, i) => {
  return `  ${i + 1}. [${c.platform.toUpperCase()}] ${c.name} (${c.campaign})${c.headline ? ` | Headline: "${c.headline}"` : ""} | CTR: ${c.ctr.toFixed(2)}% | Leads: ${c.leads}${c.cpl ? ` | CPL: R$${fmt(c.cpl)}` : ""} | Gasto: R$${fmt(c.spend)}`;
}).join("\n")}
${worstCreatives.length > 0 ? `\nCRIATIVOS SEM LEADS (com gasto significativo):\n${worstCreatives.map(c => `  • [${c.platform.toUpperCase()}] ${c.name}: CTR ${c.ctr.toFixed(2)}%, Gasto R$${fmt(c.spend)}, 0 leads`).join("\n")}` : ""}
`.trim() : "";

    const formCampaignContext = formsByCampaign.size > 0 ? `
FORMULÁRIOS POR CAMPANHA (cross-product analysis):
${Array.from(formsByCampaign.entries()).sort((a, b) => {
  const totalA = Array.from(a[1].values()).reduce((s, v) => s + v, 0);
  const totalB = Array.from(b[1].values()).reduce((s, v) => s + v, 0);
  return totalB - totalA;
}).slice(0, 10).map(([camp, forms]) => {
  const total = Array.from(forms.values()).reduce((s, v) => s + v, 0);
  const formList = Array.from(forms.entries()).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} (${n})`).join(", ");
  return `  • ${camp} → ${total} leads: ${formList}`;
}).join("\n")}
`.trim() : "";

    const fullContext = [summaryContext, metaContext, googleContext, keywordsContext, searchTermsContext, placementsContext, creativesContext, formCampaignContext].filter(Boolean).join("\n\n");

    // ── 9. Build Claude prompt ───────────────────────────────────────────────
    const systemPrompt = `Você é um estrategista sênior de geração de leads via mídia paga, especialista em Meta Ads e Google Ads. Sua função é transformar dados brutos em diagnósticos precisos e recomendações acionáveis para otimizar performance de campanhas de geração de leads.

REGRAS OBRIGATÓRIAS:
- NUNCA repita os números brutos que já estão nos dados. O gestor já os conhece.
- SEMPRE interprete o que os números significam: o que está bom, o que está ruim, por quê.
- SEMPRE termine cada seção com uma conclusão clara ou ação recomendada.
- Use linguagem direta de gestor de tráfego, sem enrolação.
- Foco em CPL, volume de leads, taxa de conversão, CPC, CTR.
- NÃO existe venda neste contexto — apenas leads.
- Quando analisar Google Ads, considere palavras-chave, termos de pesquisa, CPC e conversões.
- Quando analisar Meta Ads, considere posicionamentos, criativos, audiências e CPL.
- Identifique padrões cross-platform: leads que vêm de uma campanha mas convertem em outro formulário indicam interesse cross-product.`;

    const hasGoogle = googleCampaigns.length > 0 || topKeywords.length > 0;
    const hasMeta = metaCampaigns.length > 0;

    const userPrompt = `Analise os dados de performance de geração de leads abaixo e gere um diagnóstico estratégico completo.

DADOS DO PERÍODO:
${fullContext}

Responda EXATAMENTE neste formato (sem introdução, sem conclusão geral, só as seções):

**1. Resumo Executivo**
Em 3-4 frases: resultado geral do período, CPL por plataforma, tendência de volume. Destaque o que funcionou e o que não funcionou.

**2. Diagnóstico Meta Ads**
${hasMeta
  ? "Para cada campanha Meta: veredicto (escalar / manter / pausar / otimizar) com justificativa baseada em CPL e volume. Analise posicionamentos: onde estão as melhores conversões? Feed vs Stories vs Reels? Alguma campanha gera leads para produtos de outras campanhas (cross-product)?"
  : "Sem dados de Meta Ads no período. Pule esta seção."}

**3. Diagnóstico Google Ads**
${hasGoogle
  ? "Para cada campanha Google: veredicto com justificativa. Analise as top palavras-chave: quais geram conversão com CPC eficiente? Quais termos de pesquisa revelam intenção de compra? Há termos irrelevantes consumindo budget? Recomendações de palavras negativas?"
  : "Sem dados de Google Ads no período. Pule esta seção."}

**4. Análise de Criativos e Anúncios**
${topCreatives.length > 0
  ? "Qual padrão une os criativos que geram leads? (formato, abordagem, tema, headline). Quais estão gastando sem gerar? Para Google Search: as headlines dos anúncios estão alinhadas com a intenção de busca?"
  : "Com base nos UTMs, identifique quais anúncios geraram leads e o que isso revela."}

**5. Sugestões de Novos Criativos e Anúncios**
Sugira exatamente 4 criativos/anúncios para testar (2 Meta + 2 Google se houver dados de ambos):
Para Meta:
- Formato: [vídeo / imagem / carrossel]
- Headline e gancho
- Hipótese baseada nos dados

Para Google Search:
- Headlines recomendadas (3 variações)
- Palavras-chave a adicionar
- Palavras negativas a considerar

**6. Perfil do Lead e Jornada**
Com base nos formulários, origens, UTMs, posicionamentos e termos de pesquisa: quem é esse lead? Como ele descobriu o produto/serviço? Qual é a dor principal? Qual caminho de conversão funciona melhor?

**7. Top 5 Ações para Esta Semana**
Liste 5 ações ordenadas por impacto, cada uma com:
- O que fazer (específico, não genérico)
- Em qual plataforma (Meta / Google / ambas)
- Por quê (baseado nos dados)
- Como medir o resultado`;

    // ── 10. Call Claude API ──────────────────────────────────────────────────
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 6000, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] }),
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
        hasCampaigns: campaignRows.length > 0,
        hasCreatives: topCreatives.length > 0,
        hasKeywords: topKeywords.length > 0,
        hasSearchTerms: topSearchTerms.length > 0,
        hasPlacements: topPlacements.length > 0,
        hasAudience: false,
        metaLeads: metaLeads.length,
        googleLeads: googleLeads.length,
      },
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erro interno." }, { status: 500 });
  }
}
