-- ============================================================================
-- pdgrowth-funis — schema (compartilha projeto Supabase com outros pdgrowth-*).
-- Todas as tabelas/views são prefixadas com funis_ pra evitar colisão.
-- Apply: SQL Editor do Supabase, executar o arquivo inteiro.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- accounts: agência (você). Multi-tenant nível 1.
-- ----------------------------------------------------------------------------
create table if not exists funis_accounts (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- clients: clientes finais da agência. Multi-tenant nível 2.
-- ----------------------------------------------------------------------------
create table if not exists funis_clients (
  id          uuid primary key default uuid_generate_v4(),
  account_id  uuid not null references funis_accounts(id) on delete cascade,
  name        text not null,
  slug        text not null,
  created_at  timestamptz not null default now(),
  unique (account_id, slug)
);

-- ----------------------------------------------------------------------------
-- funnels: cada funil. Slug público usado em /f/<slug>.
-- ----------------------------------------------------------------------------
create table if not exists funis_funnels (
  id          uuid primary key default uuid_generate_v4(),
  account_id  uuid not null references funis_accounts(id) on delete cascade,
  client_id   uuid not null references funis_clients(id)  on delete cascade,
  name        text not null,
  slug        text not null unique,
  status      text not null default 'active' check (status in ('active','paused','archived')),
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_funis_funnels_client on funis_funnels(client_id);

-- ----------------------------------------------------------------------------
-- steps: etapas do funil. ordem=1 é a porta de entrada (sales) que recebe o
-- tráfego do split router. As demais (bump, upsell, downsell, thanks) são só
-- tracking via pixel.
-- ----------------------------------------------------------------------------
create table if not exists funis_steps (
  id          uuid primary key default uuid_generate_v4(),
  funnel_id   uuid not null references funis_funnels(id) on delete cascade,
  ordem       int  not null,
  type        text not null check (type in ('sales','bump','upsell','downsell','thanks','custom')),
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (funnel_id, ordem)
);

create index if not exists idx_funis_steps_funnel on funis_steps(funnel_id);

-- ----------------------------------------------------------------------------
-- variants: variantes (A/B/C…) de um step. Pesos ponderados. destination_url
-- só faz sentido pra step type='sales' (porta de entrada do split). Pros
-- demais steps a variante representa só o "tratamento" sendo testado.
-- ----------------------------------------------------------------------------
create table if not exists funis_variants (
  id              uuid primary key default uuid_generate_v4(),
  step_id         uuid not null references funis_steps(id) on delete cascade,
  name            text not null,
  destination_url text not null default '',
  weight          int  not null default 50 check (weight between 0 and 100),
  status          text not null default 'active' check (status in ('active','paused')),
  created_at      timestamptz not null default now()
);

create index if not exists idx_funis_variants_step on funis_variants(step_id);

-- ----------------------------------------------------------------------------
-- visits: cada hit no split router (porta de entrada).
-- ----------------------------------------------------------------------------
create table if not exists funis_visits (
  id          uuid primary key default uuid_generate_v4(),
  funnel_id   uuid not null references funis_funnels(id) on delete cascade,
  step_id     uuid not null references funis_steps(id) on delete cascade,
  variant_id  uuid not null references funis_variants(id) on delete cascade,
  visitor_id  uuid not null,
  ip          text,
  user_agent  text,
  referer     text,
  utm_source  text,
  utm_medium  text,
  utm_campaign text,
  utm_content text,
  utm_term    text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_funis_visits_funnel    on funis_visits(funnel_id, created_at desc);
create index if not exists idx_funis_visits_variant   on funis_visits(variant_id, created_at desc);
create index if not exists idx_funis_visits_visitor   on funis_visits(visitor_id);
create index if not exists idx_funis_visits_creative  on funis_visits(funnel_id, utm_content);

-- ----------------------------------------------------------------------------
-- events: eventos disparados pelo pixel.js — view, scroll, click, add_to_cart,
-- checkout_start, purchase, purchase_order_bump, purchase_upsell.
-- step_id pode vir nulo quando o pixel não sabe (página fora do funil).
-- ----------------------------------------------------------------------------
create table if not exists funis_events (
  id          uuid primary key default uuid_generate_v4(),
  funnel_id   uuid not null references funis_funnels(id)  on delete cascade,
  step_id     uuid          references funis_steps(id)    on delete set null,
  variant_id  uuid          references funis_variants(id) on delete set null,
  visitor_id  uuid not null,
  type        text not null,
  url         text,
  value       numeric(12,2),
  meta        jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_funis_events_funnel    on funis_events(funnel_id, created_at desc);
create index if not exists idx_funis_events_visitor   on funis_events(visitor_id);
create index if not exists idx_funis_events_type      on funis_events(funnel_id, type);
create index if not exists idx_funis_events_step      on funis_events(step_id, type);

-- ----------------------------------------------------------------------------
-- purchases: vendas atribuídas (DMGuru, Hotmart...).
-- ----------------------------------------------------------------------------
create table if not exists funis_purchases (
  id                uuid primary key default uuid_generate_v4(),
  funnel_id         uuid          references funis_funnels(id)  on delete set null,
  variant_id        uuid          references funis_variants(id) on delete set null,
  visitor_id        uuid,
  gateway           text not null check (gateway in ('dmguru','hotmart','eduzz','kiwify','pagarme','manual')),
  gateway_order_id  text not null,
  status            text not null check (status in ('approved','pending','refunded','chargeback','cancelled')),
  sale_type         text not null default 'main' check (sale_type in ('main','order_bump','upsell','downsell')),
  product_id        text,
  product_name      text,
  amount            numeric(12,2) not null default 0,
  amount_net        numeric(12,2),
  payment_method    text,
  buyer_email       text,
  buyer_name        text,
  utm_source        text,
  utm_campaign      text,
  utm_content       text,
  approved_at       timestamptz,
  raw_payload       jsonb,
  created_at        timestamptz not null default now(),
  unique (gateway, gateway_order_id)
);

create index if not exists idx_funis_purchases_funnel  on funis_purchases(funnel_id, approved_at desc);
create index if not exists idx_funis_purchases_variant on funis_purchases(variant_id, status);
create index if not exists idx_funis_purchases_visitor on funis_purchases(visitor_id);

-- ----------------------------------------------------------------------------
-- Seed: conta da agência. Idempotente.
-- ----------------------------------------------------------------------------
insert into funis_accounts (name, slug)
values ('PD Growth', 'pdgrowth')
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- View: variant_metrics — visitantes únicos, vendas e receita por variante.
-- ----------------------------------------------------------------------------
create or replace view funis_variant_metrics as
select
  v.id              as variant_id,
  v.step_id,
  s.funnel_id,
  v.name            as variant_name,
  s.name            as step_name,
  s.type            as step_type,
  s.ordem           as step_ordem,
  coalesce(visits_agg.visitors, 0)        as visitors,
  coalesce(purchases_agg.sales, 0)        as sales,
  coalesce(purchases_agg.revenue, 0)      as revenue,
  case when coalesce(visits_agg.visitors, 0) > 0
       then round((coalesce(purchases_agg.sales, 0)::numeric / visits_agg.visitors) * 100, 2)
       else 0 end                          as cvr_pct
from funis_variants v
join funis_steps    s on s.id = v.step_id
left join lateral (
  select count(distinct visitor_id) as visitors
  from funis_visits where variant_id = v.id
) visits_agg on true
left join lateral (
  select count(*) as sales, coalesce(sum(amount), 0) as revenue
  from funis_purchases where variant_id = v.id and status = 'approved' and sale_type = 'main'
) purchases_agg on true;

-- ----------------------------------------------------------------------------
-- View: step_metrics — visitantes únicos por step (pra calcular drop-off).
-- Step 1 = porta de entrada (visitas vêm de funis_visits). Demais steps são
-- contados pelos eventos do pixel (type='step_view').
-- ----------------------------------------------------------------------------
create or replace view funis_step_metrics as
with step_visitors as (
  select
    s.id as step_id, s.funnel_id, s.ordem, s.name, s.type,
    (case when s.ordem = 1
          then (select count(distinct visitor_id) from funis_visits where step_id = s.id)
          else (select count(distinct visitor_id) from funis_events where step_id = s.id and type = 'step_view')
     end) as visitors
  from funis_steps s
)
select * from step_visitors;

-- ----------------------------------------------------------------------------
-- View: creative_performance — performance por criativo (utm_content) x variante.
-- Considera utm_content como ad_id quando o cliente passa esse formato.
-- ----------------------------------------------------------------------------
create or replace view funis_creative_performance as
select
  v.funnel_id,
  v.variant_id,
  coalesce(v.utm_source,   'sem-source')   as utm_source,
  coalesce(v.utm_campaign, 'sem-campanha') as utm_campaign,
  coalesce(v.utm_content,  'sem-content')  as utm_content,
  count(distinct v.visitor_id)             as visitors,
  coalesce(p_agg.sales,   0)               as sales,
  coalesce(p_agg.revenue, 0)               as revenue
from funis_visits v
left join lateral (
  select count(*) as sales, sum(amount) as revenue
  from funis_purchases p
  where p.visitor_id = v.visitor_id
    and p.variant_id = v.variant_id
    and p.status = 'approved'
    and p.sale_type = 'main'
) p_agg on true
group by v.funnel_id, v.variant_id, v.utm_source, v.utm_campaign, v.utm_content, p_agg.sales, p_agg.revenue;
