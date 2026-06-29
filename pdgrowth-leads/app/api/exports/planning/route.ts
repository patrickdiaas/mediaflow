// GET /api/exports/planning?clients=medsystems,beautysystems&days=60
//
// Gera um markdown consolidado com os dados de mídia dos clientes informados
// nos últimos N dias. Pensado pra colar no Claude Chat e pedir planejamento
// de redistribuição de budget. Não exige secret (dados não são sensíveis;
// já são lidos pelo dashboard anon). Resposta tem content-type text/markdown
// pra ficar fácil de copiar/baixar.

import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import {
  buildAttributionIndex,
  attributeLead,
  fetchAliases,
  fetchEventMaps,
} from "@/lib/campaign-attribution";
import { isCampaignLead } from "@/lib/leads-filter";

const fmt = (n: number) =>
  Number(n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: number) =>
  Number(n ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const pct = (n: number) => `${Number(n ?? 0).toFixed(2)}%`;

interface CampaignAgg {
  platform: "meta" | "google";
  campaign_id: string;
  campaign_name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
}

async function buildClientReport(clientSlug: string, since: string, until: string): Promise<string> {
  const supabase = createServiceClient();

  // ── 1. Campanhas (somatório do período) ───────────────────────────────────
  const { data: campsRaw } = await supabase
    .from("ad_campaigns")
    .select("platform, campaign_id, campaign_name, status, spend, impressions, clicks, date")
    .eq("client_slug", clientSlug)
    .gte("date", since)
    .lte("date", until);

  const campMap = new Map<string, CampaignAgg>();
  for (const r of campsRaw ?? []) {
    const key = `${r.platform}::${r.campaign_id}`;
    const ex = campMap.get(key);
    if (ex) {
      ex.spend += Number(r.spend);
      ex.impressions += Number(r.impressions);
      ex.clicks += Number(r.clicks);
      if (r.status) ex.status = r.status; // último status visto
    } else {
      campMap.set(key, {
        platform: r.platform as "meta" | "google",
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name ?? "",
        status: r.status ?? "",
        spend: Number(r.spend),
        impressions: Number(r.impressions),
        clicks: Number(r.clicks),
        leads: 0,
      });
    }
  }

  // ── 2. Leads + atribuição ────────────────────────────────────────────────
  const aliases = await fetchAliases(supabase, clientSlug);
  const eventMaps = await fetchEventMaps(supabase, clientSlug);
  const eventSet = new Set(eventMaps.map(e => e.conversion_event));

  // BRT adjustment para alinhar com período
  const since00 = `${since}T00:00:00Z`;
  const until23 = `${until}T23:59:59Z`;
  const { data: leadsRaw } = await supabase
    .from("leads")
    .select("converted_at, conversion_event, utm_source, utm_medium, utm_campaign, utm_content, utm_term, source")
    .eq("client_slug", clientSlug)
    .gte("converted_at", since00)
    .lte("converted_at", until23);

  const leads = (leadsRaw ?? []).filter(l => isCampaignLead(l, eventSet));

  // Constrói índice de atribuição
  const campsForIndex = Array.from(campMap.values()).map(c => ({
    campaign_name: c.campaign_name,
    campaign_id: c.campaign_id,
  }));
  const idx = buildAttributionIndex(campsForIndex, aliases, eventMaps);

  // Mapa nome → entrada agregada (pode ter duplicatas se mesmo campaign_name em meta e google,
  // mas a chave de campMap é `${platform}::${campaign_id}` então não conflita aqui).
  // Pra atribuição usamos campaign_name → primeira entrada que casar.
  const byName = new Map<string, CampaignAgg>();
  for (const c of Array.from(campMap.values())) {
    if (!byName.has(c.campaign_name)) byName.set(c.campaign_name, c);
  }

  for (const l of leads) {
    const date = l.converted_at ? String(l.converted_at).slice(0, 10) : null;
    const r = attributeLead(l.utm_campaign, idx, l.conversion_event, date);
    if (!r.campaign_name) continue;
    const entry = byName.get(r.campaign_name);
    if (entry) entry.leads++;
  }

  // ── 3. Totais por plataforma ────────────────────────────────────────────
  const camps = Array.from(campMap.values()).filter(c => c.spend > 0 || c.leads > 0);
  const meta = camps.filter(c => c.platform === "meta");
  const google = camps.filter(c => c.platform === "google");

  const sumSpend = (xs: CampaignAgg[]) => xs.reduce((s, c) => s + c.spend, 0);
  const sumLeads = (xs: CampaignAgg[]) => xs.reduce((s, c) => s + c.leads, 0);
  const sumImps = (xs: CampaignAgg[]) => xs.reduce((s, c) => s + c.impressions, 0);
  const sumClicks = (xs: CampaignAgg[]) => xs.reduce((s, c) => s + c.clicks, 0);

  const metaSpend = sumSpend(meta);
  const googleSpend = sumSpend(google);
  const totalSpend = metaSpend + googleSpend;
  const metaLeads = sumLeads(meta);
  const googleLeads = sumLeads(google);
  const totalLeads = metaLeads + googleLeads;
  const totalImps = sumImps(meta) + sumImps(google);
  const totalClicks = sumClicks(meta) + sumClicks(google);

  // Ordena campanhas por spend (descendente)
  meta.sort((a, b) => b.spend - a.spend);
  google.sort((a, b) => b.spend - a.spend);

  const statusLabel = (s: string) => {
    const u = (s ?? "").toUpperCase();
    if (u === "ACTIVE" || u === "ENABLED") return "Ativa";
    if (u === "PAUSED") return "Pausada";
    if (u === "DISABLED" || u === "ARCHIVED") return "Arquivada";
    return s || "—";
  };

  const campRow = (c: CampaignAgg) => {
    const cpl = c.leads > 0 ? c.spend / c.leads : null;
    const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
    return `| ${c.campaign_name} | ${statusLabel(c.status)} | R$ ${fmt(c.spend)} | ${fmtInt(c.leads)} | ${cpl ? `R$ ${fmt(cpl)}` : "—"} | ${pct(ctr)} |`;
  };

  const overallCpl = totalLeads > 0 ? totalSpend / totalLeads : null;
  const overallCtr = totalImps > 0 ? (totalClicks / totalImps) * 100 : 0;

  // ── 4. Markdown ──────────────────────────────────────────────────────────
  return [
    `## ${clientSlug.toUpperCase()}`,
    ``,
    `**Período:** ${since} a ${until} · **Total invest:** R$ ${fmt(totalSpend)} · **Total leads:** ${fmtInt(totalLeads)} · **CPL geral:** ${overallCpl ? `R$ ${fmt(overallCpl)}` : "—"} · **CTR geral:** ${pct(overallCtr)}`,
    ``,
    `### Resumo por canal`,
    `| Canal | Investimento | Leads | CPL | Share invest |`,
    `|---|---:|---:|---:|---:|`,
    `| Meta Ads | R$ ${fmt(metaSpend)} | ${fmtInt(metaLeads)} | ${metaLeads > 0 ? `R$ ${fmt(metaSpend / metaLeads)}` : "—"} | ${totalSpend > 0 ? `${((metaSpend / totalSpend) * 100).toFixed(1)}%` : "—"} |`,
    `| Google Ads | R$ ${fmt(googleSpend)} | ${fmtInt(googleLeads)} | ${googleLeads > 0 ? `R$ ${fmt(googleSpend / googleLeads)}` : "—"} | ${totalSpend > 0 ? `${((googleSpend / totalSpend) * 100).toFixed(1)}%` : "—"} |`,
    ``,
    meta.length > 0
      ? [
          `### Meta Ads — campanhas`,
          `| Campanha | Status | Invest | Leads | CPL | CTR |`,
          `|---|---|---:|---:|---:|---:|`,
          ...meta.map(campRow),
        ].join("\n")
      : `### Meta Ads — campanhas\n_Nenhuma campanha Meta com investimento no período._`,
    ``,
    google.length > 0
      ? [
          `### Google Ads — campanhas`,
          `| Campanha | Status | Invest | Leads | CPL | CTR |`,
          `|---|---|---:|---:|---:|---:|`,
          ...google.map(campRow),
        ].join("\n")
      : `### Google Ads — campanhas\n_Nenhuma campanha Google com investimento no período._`,
    ``,
  ].join("\n");
}

export async function GET(req: NextRequest) {
  const clientsParam = req.nextUrl.searchParams.get("clients") ?? "medsystems,beautysystems";
  const days = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("days") ?? "60", 10), 1), 180);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const until = new Date(today);
  until.setUTCDate(until.getUTCDate() - 1); // até ontem (dados de hoje incompletos)
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - days + 1);

  const sinceISO = since.toISOString().slice(0, 10);
  const untilISO = until.toISOString().slice(0, 10);

  const clientSlugs = clientsParam.split(",").map(s => s.trim()).filter(Boolean);

  const sections: string[] = [];
  for (const slug of clientSlugs) {
    try {
      const md = await buildClientReport(slug, sinceISO, untilISO);
      sections.push(md);
    } catch (err) {
      sections.push(`## ${slug.toUpperCase()}\n\n_Erro ao buscar dados: ${String(err)}_\n`);
    }
  }

  const header = [
    `# Dados de Mídia — base para planejamento de budget`,
    ``,
    `**Período analisado:** ${sinceISO} a ${untilISO} (últimos ${days} dias)`,
    `**Gerado em:** ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`,
    `**Clientes incluídos:** ${clientSlugs.join(", ")}`,
    ``,
    `> Atribuição de leads: cada lead foi atribuído à campanha via cadeia exato → campaign_id → alias → fuzzy → event mapping. Leads sem utm_medium pago e leads do CRM (Negociação criada/atualizada) foram excluídos.`,
    ``,
    `---`,
    ``,
  ].join("\n");

  const md = header + sections.join("\n---\n\n");

  return new Response(md, {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `inline; filename="planejamento-midia-${sinceISO}-a-${untilISO}.md"`,
    },
  });
}
