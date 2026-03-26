-- PD Growth Vendas — Supabase Schema
-- Apply at: https://supabase.com/dashboard/project/_/sql

-- ─── Clients ──────────────────────────────────────────────────────────────────
create table if not exists clients (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text unique not null,
  name                    text not null,
  meta_ad_account_id      text,
  google_ads_customer_id  text,
  active                  boolean default true,
  created_at              timestamptz default now()
);

-- ─── Sales ────────────────────────────────────────────────────────────────────
-- Unified table for all gateways (DMGuru, Hotmart, Eduzz)
create table if not exists sales (
  id                uuid primary key default gen_random_uuid(),
  client_slug       text not null references clients(slug),
  gateway           text not null check (gateway in ('dmguru', 'hotmart', 'eduzz')),
  gateway_order_id  text not null,
  status            text not null check (status in ('approved', 'refunded', 'chargeback', 'pending', 'cancelled')),
  sale_type         text not null default 'main' check (sale_type in ('main', 'order_bump', 'upsell')),
  product_id        text,
  product_name      text,
  plan_name         text,
  amount            numeric(10,2) not null,
  currency          text default 'BRL',
  payment_method    text,
  -- Buyer
  buyer_name        text,
  buyer_email       text,
  buyer_phone       text,
  -- UTM tracking
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_content       text,
  utm_term          text,
  -- Timestamps
  approved_at       timestamptz,
  created_at        timestamptz default now(),
  raw_payload       jsonb,
  unique (gateway, gateway_order_id)
);

-- ─── Ad Campaigns ─────────────────────────────────────────────────────────────
create table if not exists ad_campaigns (
  id              uuid primary key default gen_random_uuid(),
  client_slug     text not null references clients(slug),
  platform        text not null check (platform in ('meta', 'google')),
  campaign_id     text not null,
  campaign_name   text not null,
  status          text,
  objective       text,
  date            date not null,
  impressions     bigint default 0,
  clicks          bigint default 0,
  spend           numeric(10,2) default 0,
  reach           bigint default 0,
  created_at      timestamptz default now(),
  unique (platform, campaign_id, date)
);

-- ─── Ad Sets ──────────────────────────────────────────────────────────────────
create table if not exists ad_sets (
  id              uuid primary key default gen_random_uuid(),
  client_slug     text not null references clients(slug),
  platform        text not null check (platform in ('meta', 'google')),
  campaign_id     text not null,
  campaign_name   text,
  ad_set_id       text not null,
  ad_set_name     text not null,
  status          text,
  date            date not null,
  impressions     bigint default 0,
  clicks          bigint default 0,
  spend           numeric(10,2) default 0,
  reach           bigint default 0,
  created_at      timestamptz default now(),
  unique (platform, ad_set_id, date)
);

-- ─── Ad Creatives ─────────────────────────────────────────────────────────────
create table if not exists ad_creatives (
  id              uuid primary key default gen_random_uuid(),
  client_slug     text not null references clients(slug),
  platform        text not null check (platform in ('meta', 'google')),
  campaign_id     text,
  campaign_name   text,
  ad_set_id       text,
  ad_set_name     text,
  ad_id           text not null,
  ad_name         text not null,
  status          text,
  creative_type   text check (creative_type in ('image', 'video', 'carousel', 'collection')),
  thumbnail_url   text,
  video_url       text,
  headline        text,
  body            text,
  date            date not null,
  impressions     bigint default 0,
  clicks          bigint default 0,
  spend           numeric(10,2) default 0,
  reach           bigint default 0,
  created_at      timestamptz default now(),
  unique (platform, ad_id, date)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists sales_client_slug_idx        on sales(client_slug);
create index if not exists sales_created_at_idx         on sales(created_at);
create index if not exists sales_utm_campaign_idx       on sales(utm_campaign);
create index if not exists sales_gateway_idx            on sales(gateway);
create index if not exists ad_campaigns_client_idx      on ad_campaigns(client_slug, date);
create index if not exists ad_sets_client_idx           on ad_sets(client_slug, date);
create index if not exists ad_creatives_client_idx      on ad_creatives(client_slug, date);

-- ─── Migration: add sale_type (run if table already exists) ───────────────────
-- alter table sales add column if not exists
--   sale_type text not null default 'main' check (sale_type in ('main', 'order_bump', 'upsell'));

-- ─── Seed clients ─────────────────────────────────────────────────────────────
insert into clients (slug, name) values
  ('amplainstituto', 'Ampla Instituto'),
  ('bixarica',       'Bixa Rica')
on conflict (slug) do nothing;
