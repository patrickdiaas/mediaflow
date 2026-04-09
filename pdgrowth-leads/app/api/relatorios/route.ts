import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const maxDuration = 120; // 2 min for Vercel

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtInt(n: number) {
  return n.toLocaleString("pt-BR");
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

type ReportType = "semanal" | "quinzenal" | "mensal";

export async function POST(req: NextRequest) {
  try {
    const { client, period_from, period_to, reportType } = await req.json() as {
      client: string; period_from: string; period_to: string; reportType: ReportType;
    };

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada." }, { status: 500 });
    if (!client || !period_from || !period_to) return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });

    const supabase = createServiceClient();
    const dateSince = period_from.slice(0, 10);
    const dateUntil = period_to.slice(0, 10);

    // ── Fetch all data ───────────────────────────────────────────────────────
    const { data: leadsRaw } = await supabase
      .from("leads")
      .select("id, converted_at, source, conversion_event, utm_source, utm_medium, utm_campaign, utm_content, utm_term")
      .eq("client_slug", client)
      .not("utm_medium", "is", null)
      .gte("converted_at", period_from)
      .lte("converted_at", period_to);
    const leads = leadsRaw ?? [];

    const metaLeads = leads.filter(l => {
      const src = (l.utm_source ?? "").toLowerCase();
      return src === "facebook" || src === "fb" || src === "instagram" || src === "ig" || src === "facebook ads";
    });
    const googleLeads = leads.filter(l => (l.utm_source ?? "").toLowerCase() === "google");

    // Forms
    const formMap = new Map<string, number>();
    for (const l of leads) formMap.set(l.conversion_event ?? "desconhecido", (formMap.get(l.conversion_event ?? "desconhecido") ?? 0) + 1);
    const topForms = Array.from(formMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);

    // Campaigns
    const { data: adCampaigns } = await supabase
      .from("ad_campaigns")
      .select("campaign_id, campaign_name, platform, impressions, clicks, spend, reach")
      .eq("client_slug", client).gte("date", dateSince).lte("date", dateUntil);

    const campAgg = new Map<string, { name: string; platform: string; campaignIds: Set<string>; spend: number; impressions: number; clicks: number; reach: number; leads: number }>();
    for (const c of (adCampaigns ?? [])) {
      const key = c.campaign_name;
      const e = campAgg.get(key) ?? { name: c.campaign_name, platform: c.platform, campaignIds: new Set(), spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0 };
      e.spend += Number(c.spend); e.impressions += Number(c.impressions); e.clicks += Number(c.clicks); e.reach += Number(c.reach);
      if (c.campaign_id) e.campaignIds.add(c.campaign_id);
      campAgg.set(key, e);
    }

    // Attribute leads
    const campNames = Array.from(campAgg.keys());
    const campIdToName = new Map<string, string>();
    for (const [name, data] of Array.from(campAgg.entries())) {
      for (const cid of Array.from(data.campaignIds)) campIdToName.set(cid, name);
    }
    for (const l of leads) {
      if (!l.utm_campaign) continue;
      const utmCamp = l.utm_campaign;
      const exact = campNames.find(n => n === utmCamp);
      if (exact) { campAgg.get(exact)!.leads++; continue; }
      const byId = campIdToName.get(utmCamp);
      if (byId) { campAgg.get(byId)!.leads++; continue; }
      const fuzzy = campNames.find(n => fuzzyMatch(n, utmCamp));
      if (fuzzy) { campAgg.get(fuzzy)!.leads++; }
    }

    const campaignRows = Array.from(campAgg.values())
      .map(c => ({ ...c, ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0, cpl: c.leads > 0 ? c.spend / c.leads : null }))
      .sort((a, b) => (b.leads || 0) - (a.leads || 0));

    const totalSpend = campaignRows.reduce((s, c) => s + c.spend, 0);
    const totalImpressions = campaignRows.reduce((s, c) => s + c.impressions, 0);
    const totalClicks = campaignRows.reduce((s, c) => s + c.clicks, 0);
    const overallCpl = leads.length > 0 && totalSpend > 0 ? totalSpend / leads.length : 0;
    const overallCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    // Creatives
    const { data: adCreatives } = await supabase
      .from("ad_creatives")
      .select("ad_id, ad_name, campaign_name, platform, creative_type, headline, impressions, clicks, spend")
      .eq("client_slug", client).gte("date", dateSince).lte("date", dateUntil);

    const creativeAgg = new Map<string, { name: string; campaign: string; platform: string; type: string | null; headline: string | null; spend: number; impressions: number; clicks: number; leads: number }>();
    for (const c of (adCreatives ?? [])) {
      const e = creativeAgg.get(c.ad_id) ?? { name: c.ad_name, campaign: c.campaign_name ?? "", platform: c.platform, type: c.creative_type, headline: c.headline, spend: 0, impressions: 0, clicks: 0, leads: 0 };
      e.spend += Number(c.spend); e.impressions += Number(c.impressions); e.clicks += Number(c.clicks);
      creativeAgg.set(c.ad_id, e);
    }
    for (const l of leads) {
      if (!l.utm_term) continue;
      for (const [, e] of Array.from(creativeAgg.entries())) {
        if (e.name === l.utm_term || fuzzyMatch(e.name, l.utm_term)) { e.leads++; break; }
      }
    }
    const topCreatives = Array.from(creativeAgg.values())
      .map(c => ({ ...c, ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0, cpl: c.leads > 0 ? c.spend / c.leads : null }))
      .filter(c => c.leads > 0).sort((a, b) => b.leads - a.leads).slice(0, 5);

    // Keywords
    const { data: kwData } = await supabase
      .from("keywords").select("keyword_text, campaign_name, impressions, clicks, spend, conversions")
      .eq("client_slug", client).gte("date", dateSince).lte("date", dateUntil);
    const kwAgg = new Map<string, { campaign: string; clicks: number; spend: number; conversions: number }>();
    for (const k of (kwData ?? [])) {
      if (!k.keyword_text) continue;
      const e = kwAgg.get(k.keyword_text) ?? { campaign: k.campaign_name ?? "", clicks: 0, spend: 0, conversions: 0 };
      e.clicks += Number(k.clicks); e.spend += Number(k.spend ?? 0); e.conversions += Number(k.conversions ?? 0);
      kwAgg.set(k.keyword_text, e);
    }
    const topKw = Array.from(kwAgg.entries()).map(([text, v]) => ({ text, ...v })).sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks).slice(0, 10);

    // ── Build KPIs summary ───────────────────────────────────────────────────
    const kpis = {
      leads: leads.length,
      metaLeads: metaLeads.length,
      googleLeads: googleLeads.length,
      spend: totalSpend,
      cpl: overallCpl,
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: overallCtr,
    };

    // ── Build context for Claude ─────────────────────────────────────────────
    const periodLabel = `${new Date(period_from).toLocaleDateString("pt-BR")} a ${new Date(period_to).toLocaleDateString("pt-BR")}`;
    const typeLabel = reportType === "semanal" ? "Semanal" : reportType === "quinzenal" ? "Quinzenal" : "Mensal";

    const context = `
RELATÓRIO ${typeLabel.toUpperCase()} — ${periodLabel}

KPIs:
- Leads gerados: ${leads.length} (Meta: ${metaLeads.length} | Google: ${googleLeads.length})
- Investimento: R$ ${fmt(totalSpend)}
- CPL geral: ${overallCpl > 0 ? `R$ ${fmt(overallCpl)}` : "—"}
- Impressões: ${fmtInt(totalImpressions)}
- Cliques: ${fmtInt(totalClicks)}
- CTR: ${overallCtr.toFixed(2)}%

CAMPANHAS:
${campaignRows.filter(c => c.leads > 0 || c.spend > 100).map(c => {
  return `  • [${c.platform.toUpperCase()}] ${c.name} | R$${fmt(c.spend)} | ${fmtInt(c.impressions)} impr | ${c.leads} leads${c.cpl ? ` | CPL R$${fmt(c.cpl)}` : ""}`;
}).join("\n")}

TOP CRIATIVOS:
${topCreatives.map((c, i) => `  ${i + 1}. [${c.platform.toUpperCase()}] ${c.name} | ${c.leads} leads | CTR ${c.ctr.toFixed(2)}%${c.cpl ? ` | CPL R$${fmt(c.cpl)}` : ""}`).join("\n") || "  Sem dados suficientes"}

FORMULÁRIOS:
${topForms.map(([f, n]) => `  • ${f}: ${n} leads`).join("\n")}

${topKw.length > 0 ? `TOP PALAVRAS-CHAVE GOOGLE:\n${topKw.map((k, i) => `  ${i + 1}. "${k.text}" | ${k.clicks} cliques | ${k.conversions.toFixed(0)} conv | R$${fmt(k.spend)}`).join("\n")}` : ""}
`.trim();

    // ── Claude prompt for report ─────────────────────────────────────────────
    const systemPrompt = `Você é o responsável por redigir relatórios de performance de mídia paga para uma equipe de marketing de uma agência. O relatório será enviado para a equipe de criação, comercial e gestores.

REGRAS:
- Linguagem profissional mas acessível — a equipe de criação não é especialista em mídia paga
- Foco em RESULTADOS e PRÓXIMOS PASSOS, não em diagnóstico técnico
- Use números para embasar, mas explique o que significam
- Destaque vitórias (campanhas que performaram bem) antes dos problemas
- Sugestões de criativos devem ser específicas e acionáveis para o time de criação
- Termine com ações claras divididas por responsável (tráfego, criação, comercial)
- Tom motivacional mas realista`;

    const userPrompt = `Gere um relatório ${typeLabel.toLowerCase()} de performance para enviar à equipe. Período: ${periodLabel}.

DADOS:
${context}

Escreva o relatório EXATAMENTE neste formato:

**1. Resultados do Período**
Resumo executivo dos resultados: quantos leads geramos, quanto investimos, qual o CPL. Compare Meta vs Google. Destaque o que foi positivo.

**2. Destaques de Campanhas**
As campanhas que mais geraram leads e com melhor CPL. Para cada uma, explique em 1 frase o que está funcionando. Mencione também campanhas que precisam de atenção.

**3. Performance de Criativos**
Quais criativos/anúncios geraram mais leads? Qual padrão de comunicação está funcionando? O que a equipe de criação deve saber sobre o que converte.

**4. Recomendações de Novos Criativos**
Liste 3-4 sugestões de criativos para a equipe produzir na próxima ${reportType === "semanal" ? "semana" : reportType === "quinzenal" ? "quinzena" : "mês"}. Para cada:
- Formato (vídeo/imagem/carrossel)
- Conceito e mensagem principal
- Referência: qual criativo atual inspirou essa sugestão
- Plataforma alvo (Meta/Google/ambas)

**5. Palavras-chave e Busca (Google)**
${topKw.length > 0 ? "Quais termos as pessoas estão buscando? O que isso revela sobre a intenção do público? Algum ajuste necessário?" : "Sem dados de Google Ads no período."}

**6. Próximos Passos**
Divida as ações por área:
- **Tráfego**: ajustes de campanha, budget, segmentação
- **Criação**: novos criativos a produzir, ajustes de copy/visual
- **Comercial**: insights sobre os leads que podem ajudar no atendimento`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 5000, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return NextResponse.json({ error: `Erro na API Claude: ${err}` }, { status: 500 });
    }

    const claudeData = await claudeRes.json();
    const report = claudeData.content?.[0]?.text ?? "Sem resposta.";

    return NextResponse.json({ report, context, kpis, reportType });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erro interno." }, { status: 500 });
  }
}
