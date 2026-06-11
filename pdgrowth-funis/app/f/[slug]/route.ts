import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { pickVariant } from "@/lib/attribution";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VISITOR_COOKIE = "mf_vid";
const variantCookieFor = (slug: string) => `mf_v_${slug}`;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 dias

/**
 * Split router: GET /f/<slug>
 *
 * - Lê o funil pelo slug e a primeira etapa (sales)
 * - Resolve a variante: cookie persistente OR sorteio por peso
 * - Loga a visita
 * - Redireciona pra destination_url adicionando mfv/mfvar/mfs na query string
 *
 * O pixel.js (carregado na sales page externa) lê esses params, persiste em
 * cookie de 1ª festa e injeta nos forms do checkout pra fechar a atribuição.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const slug = params.slug;
  const supabase = createServiceClient();

  // 1. Carrega funil + primeira etapa + variantes ativas
  const { data: funnel, error: funnelErr } = await supabase
    .from("funis_funnels")
    .select("id, status")
    .eq("slug", slug)
    .maybeSingle();

  if (funnelErr || !funnel) {
    return new NextResponse("Funil não encontrado", { status: 404 });
  }
  if (funnel.status !== "active") {
    return new NextResponse("Funil indisponível", { status: 410 });
  }

  const { data: firstStep } = await supabase
    .from("funis_steps")
    .select("id")
    .eq("funnel_id", funnel.id)
    .order("ordem", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!firstStep) {
    return new NextResponse("Funil sem etapas configuradas", { status: 409 });
  }

  const { data: variants } = await supabase
    .from("funis_variants")
    .select("id, name, destination_url, weight, status")
    .eq("step_id", firstStep.id)
    .eq("status", "active");

  const active = (variants ?? []).filter(v => v.weight > 0);
  if (active.length === 0) {
    return new NextResponse("Nenhuma variante ativa", { status: 409 });
  }

  // 2. Resolve visitor_id (cookie persistente)
  let visitorId = req.cookies.get(VISITOR_COOKIE)?.value;
  const isNewVisitor = !visitorId;
  if (!visitorId) visitorId = randomUUID();

  // 3. Resolve variante: sticky cookie OU sorteio
  const stickyId = req.cookies.get(variantCookieFor(slug))?.value;
  let chosen = active.find(v => v.id === stickyId);
  if (!chosen) {
    chosen = pickVariant(active) ?? active[0];
  }

  // 4. Loga a visita (assíncrono, não bloqueia o redirect)
  const url = new URL(req.url);
  const utm = (k: string) => url.searchParams.get(k);
  const visitPayload = {
    funnel_id:    funnel.id,
    step_id:      firstStep.id,
    variant_id:   chosen.id,
    visitor_id:   visitorId,
    ip:           req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent:   req.headers.get("user-agent") ?? null,
    referer:      req.headers.get("referer") ?? null,
    utm_source:   utm("utm_source"),
    utm_medium:   utm("utm_medium"),
    utm_campaign: utm("utm_campaign"),
    utm_content:  utm("utm_content"),
    utm_term:     utm("utm_term"),
  };
  supabase.from("funis_visits").insert(visitPayload).then(({ error }) => {
    if (error) console.error("[split-router] visit insert", error);
  });

  // 5. Monta a URL de destino com os params de atribuição
  const dest = new URL(chosen.destination_url);
  dest.searchParams.set("mfv",   visitorId);
  dest.searchParams.set("mfvar", chosen.id);
  dest.searchParams.set("mfs",   slug);

  // Repassa UTMs originais (pra ads tracking continuar funcionando)
  for (const key of ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"]) {
    const v = utm(key);
    if (v && !dest.searchParams.has(key)) dest.searchParams.set(key, v);
  }

  const res = NextResponse.redirect(dest.toString(), 302);

  if (isNewVisitor) {
    res.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: false, // pixel.js precisa ler do JS se voltar pelo mesmo domínio
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });
  }

  res.cookies.set(variantCookieFor(slug), chosen.id, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  return res;
}
