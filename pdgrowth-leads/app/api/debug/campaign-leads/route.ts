// GET /api/debug/campaign-leads?secret=<META_SYNC_SECRET>&slug=<client_slug>&campaign=<partial_name>&since=YYYY-MM-DD&until=YYYY-MM-DD
//
// Diagnóstico: lista TODOS os leads e ad_creatives de uma campanha específica
// no período, mostrando exatamente os campos que a atribuição usa. Permite
// descobrir por que o total do card diverge do somatório dos criativos.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (!process.env.META_SYNC_SECRET || secret !== process.env.META_SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = searchParams.get("slug");
  const campaignFilter = searchParams.get("campaign") ?? "";
  const since = searchParams.get("since") ?? "2000-01-01";
  const until = searchParams.get("until") ?? "2099-12-31";
  if (!slug) return NextResponse.json({ error: "slug obrigatório" }, { status: 400 });

  const supabase = createServiceClient();

  // 1) Ad creatives da campanha no período — mostra ad_id, ad_name, ad_set_name, spend
  const { data: creatives } = await supabase
    .from("ad_creatives")
    .select("ad_id, ad_name, campaign_name, ad_set_name, spend, date, platform")
    .eq("client_slug", slug)
    .ilike("campaign_name", `%${campaignFilter}%`)
    .gte("date", since)
    .lte("date", until)
    .order("date", { ascending: false });

  // Agrega por ad_id
  const creativeAgg = new Map<string, { ad_id: string; ad_name: string; campaign_name: string; ad_set_name: string; platform: string; spend: number; days: number }>();
  for (const c of creatives ?? []) {
    const ex = creativeAgg.get(c.ad_id);
    if (ex) { ex.spend += Number(c.spend); ex.days++; }
    else creativeAgg.set(c.ad_id, {
      ad_id: c.ad_id, ad_name: c.ad_name, campaign_name: c.campaign_name ?? "",
      ad_set_name: (c as any).ad_set_name ?? "", platform: c.platform,
      spend: Number(c.spend), days: 1,
    });
  }
  const creativesList = Array.from(creativeAgg.values()).sort((a, b) => b.spend - a.spend);

  // 2) Leads: pega TODOS os leads do cliente no período, com todos os UTMs.
  //    Não filtramos por campaign aqui — mostramos tudo pra ver o que "deveria"
  //    ir pra essa campanha e o que está indo pra outra.
  const { data: allLeads } = await supabase
    .from("leads")
    .select("id, source, conversion_event, utm_source, utm_medium, utm_campaign, utm_content, utm_term, converted_at, lead_email")
    .eq("client_slug", slug)
    .gte("converted_at", `${since}T00:00:00`)
    .lte("converted_at", `${until}T23:59:59`)
    .order("converted_at", { ascending: false });

  // Filtro auxiliar: leads que MENCIONAM a campanha (ou não têm utm_campaign)
  const relevantLeads = (allLeads ?? []).filter(l => {
    if (!campaignFilter) return true;
    const camp = (l.utm_campaign ?? "").toLowerCase();
    const cont = (l.utm_content ?? "").toLowerCase();
    const term = (l.utm_term ?? "").toLowerCase();
    const f = campaignFilter.toLowerCase();
    return camp.includes(f) || cont.includes(f) || term.includes(f) || !l.utm_campaign;
  });

  // Match preview por lead: quais criativos casam por utm_content == ad_name
  const previewMatches = relevantLeads.map(l => {
    const content = l.utm_content ?? "";
    const exactByName = creativesList.filter(c => c.ad_name === content);
    const containsMatch = exactByName.length === 0
      ? creativesList.filter(c => c.ad_name.toLowerCase().includes(content.toLowerCase()) || content.toLowerCase().includes(c.ad_name.toLowerCase()))
      : [];
    return {
      lead_id: l.id,
      source: l.source,
      converted_at: l.converted_at,
      email: l.lead_email,
      conversion_event: l.conversion_event,
      utm_campaign: l.utm_campaign,
      utm_content: l.utm_content,
      utm_term: l.utm_term,
      exact_match_count: exactByName.length,
      exact_match_ad_ids: exactByName.map(c => `${c.ad_id} (set=${c.ad_set_name})`),
      contains_match_count: containsMatch.length,
    };
  });

  return NextResponse.json({
    filter: { slug, campaign: campaignFilter, since, until },
    creatives_count: creativesList.length,
    creatives: creativesList,
    leads_total_in_period: (allLeads ?? []).length,
    leads_relevant: relevantLeads.length,
    leads: previewMatches,
  });
}
