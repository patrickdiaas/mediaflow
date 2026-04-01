-- Google Ads Keywords & Search Terms — Schema Addition
-- Apply at: https://supabase.com/dashboard/project/_/sql

-- ─── Keywords ─────────────────────────────────────────────────────────────────
-- Palavras-chave configuradas nas campanhas do Google Ads
create table if not exists keywords (
  id              uuid primary key default gen_random_uuid(),
  client_slug     text not null references clients(slug),
  platform        text not null default 'google',
  campaign_id     text not null,
  campaign_name   text,
  ad_group_id     text not null,
  ad_group_name   text,
  keyword_id      text not null,           -- criterion_id do Google Ads
  keyword_text    text not null,           -- texto da palavra-chave
  match_type      text,                    -- BROAD, PHRASE, EXACT
  status          text,
  date            date not null,
  impressions     bigint default 0,
  clicks          bigint default 0,
  spend           numeric(10,2) default 0, -- cost_micros / 1_000_000
  conversions     numeric(10,2) default 0, -- conversões rastreadas pelo Google
  created_at      timestamptz default now(),
  unique (client_slug, keyword_id, date)
);

-- ─── Search Terms ──────────────────────────────────────────────────────────────
-- Termos de pesquisa reais que acionaram os anúncios
create table if not exists search_terms (
  id              uuid primary key default gen_random_uuid(),
  client_slug     text not null references clients(slug),
  platform        text not null default 'google',
  campaign_id     text not null,
  campaign_name   text,
  ad_group_id     text not null,
  ad_group_name   text,
  keyword_id      text,                    -- criterion_id que acionou
  keyword_text    text,                    -- palavra-chave que acionou
  search_term     text not null,           -- o que o usuário digitou
  match_type      text,
  date            date not null,
  impressions     bigint default 0,
  clicks          bigint default 0,
  spend           numeric(10,2) default 0,
  conversions     numeric(10,2) default 0,
  created_at      timestamptz default now(),
  unique (client_slug, campaign_id, ad_group_id, search_term, date)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists keywords_client_idx     on keywords(client_slug, date);
create index if not exists keywords_text_idx       on keywords(client_slug, keyword_text);
create index if not exists search_terms_client_idx on search_terms(client_slug, date);
create index if not exists search_terms_text_idx   on search_terms(client_slug, search_term);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table keywords     enable row level security;
alter table search_terms enable row level security;

create policy "anon can read keywords"
  on keywords for select to anon using (true);

create policy "anon can read search_terms"
  on search_terms for select to anon using (true);

-- ─── Clients: google_ads_manager_id (MCC) ─────────────────────────────────────
-- Adiciona coluna de Manager Account (MCC) se ainda não existir
alter table clients add column if not exists google_ads_manager_id text;
alter table clients add column if not exists sales_slug text;
