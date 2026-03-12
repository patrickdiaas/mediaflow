-- ============================================================
-- MediaFlow — Schema Supabase
-- Execute no SQL Editor do seu projeto Supabase
-- ============================================================

-- ─── LEADS (RD Station → Lead Gen) ───────────────────────────────────────────
create table if not exists leads (
  id                     uuid primary key default gen_random_uuid(),

  -- Dados do lead
  nome                   text,
  email                  text not null,
  telefone               text,

  -- Origem da conversão (formulário RD Station)
  conversion_identifier  text,              -- nome do formulário/evento

  -- Rastreamento UTM
  utm_source             text,              -- ex: "facebook", "google"
  utm_medium             text,              -- ex: "cpc", "email"
  utm_campaign           text,              -- nome da campanha
  utm_content            text,              -- criativo/anúncio
  utm_term               text,              -- keyword (Google)

  -- Plataforma inferida do utm_source
  platform               text check (platform in ('meta', 'google', 'other')),

  -- Identificador do cliente (passado via ?client= na URL do webhook)
  client                 text,

  -- Controle
  created_at             timestamptz not null default now(),
  raw_payload            jsonb               -- payload completo do webhook
);

create index if not exists leads_email_idx       on leads (email);
create index if not exists leads_platform_idx    on leads (platform);
create index if not exists leads_campaign_idx    on leads (utm_campaign);
create index if not exists leads_created_at_idx  on leads (created_at desc);

-- ─── SALES (Digital Manager Guru → E-commerce) ───────────────────────────────
create table if not exists sales (
  id                uuid primary key default gen_random_uuid(),

  -- Identificador externo (idempotência)
  order_id          text unique not null,   -- ID do pedido no Guru

  -- Status do pedido
  status            text not null check (status in ('approved', 'refunded')),

  -- Dados do produto
  product_id        text,
  product_name      text,

  -- Dados financeiros
  total_value       numeric(10, 2) not null,

  -- Dados do cliente
  customer_name     text,
  customer_email    text,
  customer_phone    text,

  -- Rastreamento UTM
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_content       text,
  utm_term          text,

  -- Plataforma inferida do utm_source
  platform          text check (platform in ('meta', 'google', 'other')),

  -- Identificador do cliente (passado via ?client= na URL do webhook)
  client            text,

  -- Controle
  created_at        timestamptz not null default now(),
  raw_payload       jsonb
);

create index if not exists sales_order_id_idx    on sales (order_id);
create index if not exists sales_platform_idx    on sales (platform);
create index if not exists sales_campaign_idx    on sales (utm_campaign);
create index if not exists sales_status_idx      on sales (status);
create index if not exists sales_created_at_idx  on sales (created_at desc);

-- ─── CAMPAIGNS (Meta Ads + Google Ads sync — a implementar) ──────────────────
create table if not exists campaigns (
  id              uuid primary key default gen_random_uuid(),
  external_id     text not null,             -- ID na plataforma de anúncios
  platform        text not null check (platform in ('meta', 'google')),
  mode            text not null check (mode in ('lead-gen', 'ecommerce')),
  nome            text not null,
  status          text check (status in ('ativa', 'pausada', 'encerrada')),
  investimento    numeric(10, 2) default 0,
  impressoes      bigint default 0,
  cliques         bigint default 0,
  ctr             numeric(5, 2) default 0,
  cpc             numeric(8, 2) default 0,
  leads           int default 0,
  cpl             numeric(8, 2) default 0,
  vendas          int default 0,
  roas            numeric(6, 2) default 0,
  synced_at       timestamptz default now(),
  unique (external_id, platform)
);

-- ─── CREATIVES (Meta Ads + Google Ads sync — a implementar) ──────────────────
create table if not exists creatives (
  id              uuid primary key default gen_random_uuid(),
  external_id     text not null,
  platform        text not null check (platform in ('meta', 'google')),
  mode            text not null check (mode in ('lead-gen', 'ecommerce')),
  nome            text not null,
  tipo            text check (tipo in ('imagem', 'video', 'carrossel')),
  campaign_id     uuid references campaigns (id) on delete set null,
  campanha        text,
  impressoes      bigint default 0,
  cliques         bigint default 0,
  ctr             numeric(5, 2) default 0,
  leads           int default 0,
  cpl             numeric(8, 2) default 0,
  gasto           numeric(10, 2) default 0,
  synced_at       timestamptz default now(),
  unique (external_id, platform)
);

-- ─── KEYWORDS (Google Ads sync — a implementar) ───────────────────────────────
create table if not exists keywords (
  id              uuid primary key default gen_random_uuid(),
  external_id     text not null,
  mode            text not null check (mode in ('lead-gen', 'ecommerce')),
  termo           text not null,
  correspondencia text check (correspondencia in ('exata', 'frase', 'ampla')),
  campaign_id     uuid references campaigns (id) on delete set null,
  campanha        text,
  impressoes      bigint default 0,
  cliques         bigint default 0,
  ctr             numeric(5, 2) default 0,
  cpc             numeric(8, 2) default 0,
  leads           int default 0,
  cpl             numeric(8, 2) default 0,
  gasto           numeric(10, 2) default 0,
  synced_at       timestamptz default now(),
  unique (external_id)
);
