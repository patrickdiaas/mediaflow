# pdgrowth-funis

Plataforma de testes A/B de funil perpétuo. Distribui tráfego entre variantes de
páginas de vendas (URLs externas), persiste a variante por cookie, mede
visitantes/eventos via pixel e atribui vendas via webhook dos gateways.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Supabase · Vercel.

## Componentes

- **Split router** — `app/f/[slug]/route.ts`. Sorteia variante, seta cookie,
  loga visita e redireciona pra URL externa adicionando `mfv`, `mfvar`, `mfs`
  na query string.
- **Pixel** — `public/p.js`. Cole na sales page e na obrigado. Lê os ids da
  query string, persiste em cookie de 1ª festa, reescreve links de checkout
  (Hotmart vira `src=mf_...`; outros recebem `mfv/mfvar/mfs`), injeta hidden
  fields em todos os `<form>` e dispara `view` event.
- **Webhooks** — `app/api/webhooks/{dmguru,hotmart}/route.ts`. Extraem
  `visitor_id` e `variant_id` do payload (lógica em `lib/attribution.ts`) e
  gravam a venda na tabela `purchases` já atribuída.
- **Tracking** — `POST /api/track`. Recebe eventos do pixel (`view`,
  `add_to_cart`, `checkout_start`, custom).
- **Admin** — UI em `/` (lista de funis), `/clients`, `/funnels/new`,
  `/funnels/[slug]` (detalhes + métricas).

## Setup

```bash
cp .env.example .env.local       # preencha as variáveis
npm install
psql $DATABASE_URL -f supabase/schema.sql    # ou cole no SQL Editor
npm run dev
```

Abra http://localhost:3000, faça login com `DASHBOARD_PASSWORD`, cadastre
um cliente em `/clients`, depois crie o funil em `/funnels/new`.

## Como usar (ponta a ponta)

1. **Crie o funil** apontando 2+ URLs de variantes da sales page.
2. **Pegue o link público** `https://seu-dominio/f/<slug>` e use nos anúncios.
3. **Cole o pixel** `<script async src="https://seu-dominio/p.js"></script>` em
   TODAS as sales pages e na página de obrigado:
   ```html
   <script async src="https://funis.seu-dominio.com.br/p.js"></script>
   ```
4. **Configure os webhooks** nos gateways:
   - DMGuru: `POST /api/webhooks/dmguru?secret=$DMGURU_WEBHOOK_SECRET`
   - Hotmart: `POST /api/webhooks/hotmart?secret=$HOTMART_WEBHOOK_SECRET`
5. **Acompanhe** em `/funnels/<slug>` — visitantes, vendas, receita e CVR por variante.

## Como a atribuição funciona

O cookie não atravessa domínios. A cadeia é:

```
ad → /f/slug → [router seta visitor cookie + redirect com ?mfv=...&mfvar=...&mfs=...]
            → sales page (cliente.com.br)
              [pixel.js lê query, persiste cookie no domínio do cliente,
               reescreve links de checkout pra carregar os ids]
            → checkout (hotmart/dmguru)
              [ids viajam no campo src (hotmart) ou utm/custom (dmguru)]
            → webhook
              [extrai mfv/mfvar e atribui à variante correta]
```

## Próximos passos (não no MVP)

- Significância estatística (Bayesian beats) na tabela de variantes.
- Múltiplos steps por funil (order bump, upsell, downsell) com tracking
  separado por step.
- Domínio próprio por cliente via CNAME.
- Webhooks Eduzz, Kiwify, Pagar.me.
- Cruzar com ad spend do MediaFlow → ROAS por variante.
