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

    // Keywords by campaign
    const { data: kwData } = await supabase
      .from("keywords").select("keyword_text, campaign_name, match_type, impressions, clicks, spend, conversions")
      .eq("client_slug", client).gte("date", dateSince).lte("date", dateUntil);
    const kwByCampaign = new Map<string, { text: string; matchType: string; clicks: number; spend: number; conversions: number }[]>();
    const kwAgg = new Map<string, { campaign: string; matchType: string; clicks: number; spend: number; conversions: number }>();
    for (const k of (kwData ?? [])) {
      if (!k.keyword_text) continue;
      const camp = k.campaign_name ?? "";
      if (!kwByCampaign.has(camp)) kwByCampaign.set(camp, []);
      // aggregate per keyword
      const e = kwAgg.get(k.keyword_text) ?? { campaign: camp, matchType: k.match_type ?? "", clicks: 0, spend: 0, conversions: 0 };
      e.clicks += Number(k.clicks); e.spend += Number(k.spend ?? 0); e.conversions += Number(k.conversions ?? 0);
      kwAgg.set(k.keyword_text, e);
    }
    const topKw = Array.from(kwAgg.entries()).map(([text, v]) => ({ text, ...v })).sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks).slice(0, 15);

    // Search terms
    const { data: stData } = await supabase
      .from("search_terms").select("search_term, campaign_name, impressions, clicks, spend, conversions")
      .eq("client_slug", client).gte("date", dateSince).lte("date", dateUntil);
    const stAgg = new Map<string, { campaign: string; clicks: number; spend: number; conversions: number }>();
    for (const s of (stData ?? [])) {
      if (!s.search_term) continue;
      const e = stAgg.get(s.search_term) ?? { campaign: s.campaign_name ?? "", clicks: 0, spend: 0, conversions: 0 };
      e.clicks += Number(s.clicks); e.spend += Number(s.spend ?? 0); e.conversions += Number(s.conversions ?? 0);
      stAgg.set(s.search_term, e);
    }
    const topSt = Array.from(stAgg.entries()).map(([term, v]) => ({ term, ...v })).sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks).slice(0, 15);

    // Placements
    const { data: plcData } = await supabase
      .from("ad_placements").select("placement, impressions, clicks, spend, conversions")
      .eq("client_slug", client).gte("date", dateSince).lte("date", dateUntil);
    const plcAgg = new Map<string, { impressions: number; clicks: number; spend: number; conversions: number }>();
    for (const p of (plcData ?? [])) {
      const e = plcAgg.get(p.placement) ?? { impressions: 0, clicks: 0, spend: 0, conversions: 0 };
      e.impressions += Number(p.impressions); e.clicks += Number(p.clicks); e.spend += Number(p.spend); e.conversions += Number(p.conversions ?? 0);
      plcAgg.set(p.placement, e);
    }
    const topPlacements = Array.from(plcAgg.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.conversions - a.conversions).slice(0, 6);

    // Criativos agrupados por campanha
    const creativesByCampaign = new Map<string, typeof topCreatives>();
    const allCreatives = Array.from(creativeAgg.values())
      .map(c => ({ ...c, ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0, cpl: c.leads > 0 ? c.spend / c.leads : null }))
      .sort((a, b) => b.leads - a.leads);
    for (const c of allCreatives) {
      if (!creativesByCampaign.has(c.campaign)) creativesByCampaign.set(c.campaign, []);
      const arr = creativesByCampaign.get(c.campaign)!;
      if (arr.length < 3) arr.push(c);
    }

    // Formulários por campanha
    const formsByCampaign = new Map<string, Map<string, number>>();
    for (const l of leads) {
      const camp = l.utm_campaign ?? "(sem campanha)";
      const form = l.conversion_event ?? "desconhecido";
      if (!formsByCampaign.has(camp)) formsByCampaign.set(camp, new Map());
      const fMap = formsByCampaign.get(camp)!;
      fMap.set(form, (fMap.get(form) ?? 0) + 1);
    }

    // ── Build KPIs ───────────────────────────────────────────────────────────
    const metaSpend = campaignRows.filter(c => c.platform === "meta").reduce((s, c) => s + c.spend, 0);
    const googleSpend = campaignRows.filter(c => c.platform === "google").reduce((s, c) => s + c.spend, 0);
    const metaCpl = metaLeads.length > 0 && metaSpend > 0 ? metaSpend / metaLeads.length : 0;
    const googleCpl = googleLeads.length > 0 && googleSpend > 0 ? googleSpend / googleLeads.length : 0;

    const kpis = {
      leads: leads.length,
      metaLeads: metaLeads.length,
      googleLeads: googleLeads.length,
      spend: totalSpend,
      metaSpend,
      googleSpend,
      cpl: overallCpl,
      metaCpl,
      googleCpl,
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: overallCtr,
    };

    // ── Build context ────────────────────────────────────────────────────────
    const periodLabel = `${new Date(period_from).toLocaleDateString("pt-BR")} a ${new Date(period_to).toLocaleDateString("pt-BR")}`;
    const typeLabel = reportType === "semanal" ? "Semanal" : reportType === "quinzenal" ? "Quinzenal" : "Mensal";

    const metaCampaigns = campaignRows.filter(c => c.platform === "meta");
    const googleCampaigns = campaignRows.filter(c => c.platform === "google");

    const overviewContext = `
OVERVIEW GERAL — ${periodLabel}
- Total leads: ${leads.length} | Investimento: R$ ${fmt(totalSpend)} | CPL: ${overallCpl > 0 ? `R$ ${fmt(overallCpl)}` : "—"}
- Meta Ads: ${metaLeads.length} leads | R$ ${fmt(metaSpend)} investido | CPL ${metaCpl > 0 ? `R$ ${fmt(metaCpl)}` : "—"}
- Google Ads: ${googleLeads.length} leads | R$ ${fmt(googleSpend)} investido | CPL ${googleCpl > 0 ? `R$ ${fmt(googleCpl)}` : "—"}
- Impressões: ${fmtInt(totalImpressions)} | Cliques: ${fmtInt(totalClicks)} | CTR: ${overallCtr.toFixed(2)}%
- Formulários: ${topForms.map(([f, n]) => `${f} (${n})`).join(", ")}
`.trim();

    const metaDetailContext = metaCampaigns.length > 0 ? `
META ADS — DETALHAMENTO POR CAMPANHA:
${metaCampaigns.filter(c => c.leads > 0 || c.spend > 50).map(c => {
  const creatives = creativesByCampaign.get(c.name) ?? [];
  const forms = formsByCampaign.get(c.name);
  const formsStr = forms ? Array.from(forms.entries()).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f}(${n})`).join(", ") : "";
  return [
    `  CAMPANHA: ${c.name}`,
    `    Gasto: R$${fmt(c.spend)} | Impressões: ${fmtInt(c.impressions)} | Cliques: ${fmtInt(c.clicks)} | CTR: ${c.ctr.toFixed(2)}%`,
    `    Leads: ${c.leads}${c.cpl ? ` | CPL: R$${fmt(c.cpl)}` : ""}`,
    formsStr ? `    Formulários: ${formsStr}` : "",
    creatives.length > 0 ? `    Criativos:\n${creatives.map(cr => `      - ${cr.name} | ${cr.leads} leads | CTR ${cr.ctr.toFixed(2)}%${cr.cpl ? ` | CPL R$${fmt(cr.cpl)}` : ""}`).join("\n")}` : "",
  ].filter(Boolean).join("\n");
}).join("\n\n")}
${topPlacements.length > 0 ? `\n  POSICIONAMENTOS:\n${topPlacements.map(p => `    ${p.name}: ${p.conversions} conv | ${fmtInt(p.clicks)} cliques | R$${fmt(p.spend)}`).join("\n")}` : ""}
`.trim() : "";

    const googleDetailContext = googleCampaigns.length > 0 ? `
GOOGLE ADS — DETALHAMENTO POR CAMPANHA:
${googleCampaigns.filter(c => c.leads > 0 || c.spend > 50).map(c => {
  return [
    `  CAMPANHA: ${c.name}`,
    `    Gasto: R$${fmt(c.spend)} | Impressões: ${fmtInt(c.impressions)} | Cliques: ${fmtInt(c.clicks)} | CTR: ${c.ctr.toFixed(2)}%`,
    `    Leads: ${c.leads}${c.cpl ? ` | CPL: R$${fmt(c.cpl)}` : ""}`,
  ].join("\n");
}).join("\n\n")}

  TOP PALAVRAS-CHAVE:
${topKw.slice(0, 10).map((k, i) => `    ${i + 1}. "${k.text}" [${k.matchType}] | ${k.clicks} cliques | ${k.conversions.toFixed(0)} conv | CPC R$${k.clicks > 0 ? fmt(k.spend / k.clicks) : "—"}`).join("\n")}

  TOP TERMOS DE PESQUISA (o que as pessoas realmente digitam):
${topSt.slice(0, 10).map((s, i) => `    ${i + 1}. "${s.term}" | ${s.clicks} cliques | ${s.conversions.toFixed(0)} conv`).join("\n")}
`.trim() : "";

    const context = [overviewContext, metaDetailContext, googleDetailContext].filter(Boolean).join("\n\n");

    // ── Claude prompt ────────────────────────────────────────────────────────
    const systemPrompt = `Você é o responsável por redigir relatórios de performance de mídia paga para uma agência de marketing. O relatório será compartilhado com a equipe (criação, comercial e gestores).

REGRAS CRÍTICAS:
- USE APENAS os dados fornecidos. NUNCA invente números, metas ou projeções que não estejam nos dados.
- O relatório deve começar com DADOS e NÚMEROS, depois análise e recomendações.
- Linguagem profissional mas acessível para quem não é especialista em tráfego.
- Destaque vitórias antes de problemas.
- Sugestões de criativos devem ser específicas e acionáveis.
- NÃO crie metas ou benchmarks fictícios. Só compare dados que existem.`;

    const userPrompt = `Gere um relatório ${typeLabel.toLowerCase()} de performance. Período: ${periodLabel}.

DADOS:
${context}

Escreva o relatório EXATAMENTE neste formato:

**1. Overview do Período**
Números gerais: total de leads, investimento, CPL. Quebre por plataforma (Meta vs Google) com leads, investimento e CPL de cada. Liste os formulários que mais receberam leads. Seja direto com os números.

**2. Meta Ads — Resultados por Campanha**
${metaCampaigns.length > 0 ? "Para CADA campanha Meta, apresente: investimento, leads, CPL, CTR. Abaixo de cada campanha, liste os criativos que geraram leads com seus números. Mencione posicionamentos que mais converteram (Feed, Stories, Reels). Se uma campanha gerou leads em formulários de outros produtos, destaque isso." : "Sem campanhas Meta no período."}

**3. Google Ads — Resultados por Campanha**
${googleCampaigns.length > 0 ? "Para CADA campanha Google, apresente: investimento, leads, CPL, CTR. Liste as top palavras-chave com cliques e conversões. Liste os termos de pesquisa mais relevantes — o que as pessoas realmente digitaram. Destaque termos com alta conversão e termos que gastam sem converter." : "Sem campanhas Google no período."}

**4. Destaques e Pontos de Atenção**
O que funcionou bem no período? O que precisa de atenção? Quais campanhas/criativos devem ser escalados e quais devem ser revisados? Use os dados para justificar.

**5. Recomendações de Criativos**
Baseado nos criativos que mais converteram, sugira 3-4 novos criativos para o time de criação produzir:
- Formato (vídeo/imagem/carrossel)
- Conceito e mensagem
- Qual criativo atual serve de referência
- Para qual plataforma (Meta/Google)

**6. Próximos Passos**
Ações divididas por área:
- **Tráfego**: ajustes de campanha, orçamento, segmentação, palavras-chave
- **Criação**: novos criativos, ajustes de copy/visual
- **Comercial**: perfil dos leads, como abordar, insights para atendimento`;

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
