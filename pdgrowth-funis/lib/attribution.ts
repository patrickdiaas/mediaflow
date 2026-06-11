/**
 * Helpers de atribuição: extraem visitor_id (mfv) e variant_id (mfvar) de
 * payloads de webhook de gateway. Os ids viajam por query string da URL do
 * checkout, são copiados pelo pixel.js como hidden fields no form e
 * acabam em campos custom/tracking do payload do gateway.
 *
 * Estratégia: o cliente coloca {mfv} e {mfvar} em algum campo de tracking do
 * checkout. No webhook a gente tenta vários locais conhecidos.
 */

export interface Attribution {
  visitor_id: string | null;
  variant_id: string | null;
  funnel_slug: string | null;
}

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

function pickUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.match(UUID_RE);
  return match ? match[0] : null;
}

/**
 * Hotmart: o campo `src` é um único token. Convenção:
 *   src=mf_<funnel_slug>_<variant_id>_<visitor_id>
 * Também tenta os campos UTM custom (source_sck, external_reference).
 */
export function attributionFromHotmart(body: any): Attribution {
  const tracking = body?.data?.tracking ?? {};
  const candidates: string[] = [
    tracking?.source_sck,
    tracking?.external_reference,
    body?.data?.purchase?.checkout_country?.iso,
    body?.data?.subscription?.subscriber?.code,
  ].filter(Boolean);

  for (const raw of candidates) {
    if (typeof raw === "string" && raw.startsWith("mf_")) {
      const parts = raw.split("_");
      // mf, <slug>, <variant_uuid>, <visitor_uuid>
      if (parts.length >= 4) {
        return {
          funnel_slug: parts[1] ?? null,
          variant_id:  pickUuid(parts.slice(2, -1).join("-")) ?? pickUuid(parts[2]),
          visitor_id:  pickUuid(parts[parts.length - 1]),
        };
      }
    }
  }

  // Fallback: tenta achar dois uuids em qualquer campo de tracking
  const flat = JSON.stringify(tracking ?? {});
  const all = flat.match(new RegExp(UUID_RE.source, "gi")) ?? [];
  return {
    funnel_slug: null,
    variant_id:  all[0] ?? null,
    visitor_id:  all[1] ?? all[0] ?? null,
  };
}

/**
 * DMGuru: usa custom_fields, tracking_parameters e UTMs.
 * Convenção: nos parâmetros do checkout, passar:
 *   ?mfv=<visitor_id>&mfvar=<variant_id>&mfs=<funnel_slug>
 * O DMGuru repassa esses params em body.source.* ou body.tracking_parameters.
 */
export function attributionFromDMGuru(body: any): Attribution {
  const sources: Record<string, unknown> = {
    ...(body?.source ?? {}),
    ...(body?.tracking_parameters ?? {}),
    ...(body?.custom_fields ?? {}),
    utm_content: body?.source?.utm_content,
    utm_term:    body?.source?.utm_term,
  };

  const visitor =
    pickUuid(sources.mfv) ??
    pickUuid(sources.visitor_id) ??
    pickUuid(sources.utm_content) ??
    pickUuid(sources.utm_term);

  const variant =
    pickUuid(sources.mfvar) ??
    pickUuid(sources.variant_id) ??
    pickUuid(sources.utm_term);

  const slug =
    (typeof sources.mfs === "string" ? sources.mfs : null) ??
    (typeof sources.funnel_slug === "string" ? sources.funnel_slug : null);

  return { visitor_id: visitor, variant_id: variant, funnel_slug: slug };
}

/**
 * Sorteia uma variante respeitando pesos (peso 0 nunca é escolhido).
 * Variantes pausadas devem ser filtradas antes de chamar essa função.
 */
export function pickVariant<T extends { weight: number }>(variants: T[]): T | null {
  if (variants.length === 0) return null;
  const total = variants.reduce((acc, v) => acc + Math.max(0, v.weight), 0);
  if (total <= 0) return variants[0];
  let r = Math.random() * total;
  for (const v of variants) {
    r -= Math.max(0, v.weight);
    if (r <= 0) return v;
  }
  return variants[variants.length - 1];
}
