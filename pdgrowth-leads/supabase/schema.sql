-- PD Growth Leads — Supabase Schema
-- Apply at: https://supabase.com/dashboard/project/_/sql

-- ─── Clients ──────────────────────────────────────────────────────────────────
create table if not exists clients (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text unique not null,
  name                    text not null,
  display_name            text,
  meta_ad_account_id      text,
  google_ads_customer_id  text,
  google_ads_manager_id   text,
  rdstation_slug          text,               -- slug usado no webhook RD Station (?client=)
  active                  boolean default true,
  created_at              timestamptz default now()
);

-- ─── Leads ────────────────────────────────────────────────────────────────────
-- Cada conversão do RD Station vira um registro aqui
create table if not exists leads (
  id                uuid primary key default gen_random_uuid(),
  client_slug       text not null references clients(slug),
  source            text not null default 'rdstation' check (source in ('rdstation', 'meta_leadform', 'manual')),
  -- Lead info
  lead_email        text,
  lead_name         text,
  lead_phone        text,
  lead_company      text,
  -- Origem / conversão
  conversion_event  text,                     -- nome do evento/formulário (ex: "ebook-guia-seo")
  landing_page      text,                     -- URL da página de conversão
  -- UTM tracking
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_content       text,
  utm_term          text,
  -- Timestamps
  converted_at      timestamptz,              -- quando converteu
  created_at        timestamptz default now(),
  raw_payload       jsonb,
  -- Evita duplicatas
  unique (client_slug, source, lead_email, conversion_event, converted_at)
);

-- ─── Ad Campaigns ─────────────────────────────────────────────────────────────
create table if not exists ad_campaigns (
  id                     uuid primary key default gen_random_uuid(),
  client_slug            text not null references clients(slug),
  platform               text not null check (platform in ('meta', 'google')),
  campaign_id            text not null,
  campaign_name          text not null,
  status                 text,
  objective              text,
  date                   date not null,
  impressions            bigint default 0,
  clicks                 bigint default 0,
  spend                  numeric(10,2) default 0,
  reach                  bigint default 0,
  landing_page_views     bigint default 0,
  lead_form_submissions  bigint default 0,     -- conversões de formulário (Meta lead forms + Google)
  created_at             timestamptz default now(),
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
  id                    uuid primary key default gen_random_uuid(),
  client_slug           text not null references clients(slug),
  platform              text not null check (platform in ('meta', 'google')),
  campaign_id           text,
  campaign_name         text,
  ad_set_id             text,
  ad_set_name           text,
  ad_id                 text not null,
  ad_name               text not null,
  status                text,
  creative_type         text check (creative_type in ('image', 'video', 'carousel', 'collection')),
  thumbnail_url         text,
  video_url             text,
  headline              text,
  body                  text,
  permalink_url         text,
  placement             text,                  -- feed, stories, reels, audience_network, etc.
  date                  date not null,
  impressions           bigint default 0,
  clicks                bigint default 0,
  spend                 numeric(10,2) default 0,
  reach                 bigint default 0,
  frequency             numeric(6,2),
  video_3s_views        bigint,
  video_thruplay_views  bigint,
  created_at            timestamptz default now(),
  unique (platform, ad_id, date)
);

-- ─── Ad Regions ───────────────────────────────────────────────────────────────
-- Impressões e cliques por região geográfica (Meta + Google)
create table if not exists ad_regions (
  id            uuid primary key default gen_random_uuid(),
  client_slug   text not null references clients(slug),
  platform      text not null check (platform in ('meta', 'google')),
  campaign_id   text not null,
  region        text not null,                 -- nome da região (estado, cidade)
  country_code  text default 'BR',
  date          date not null,
  impressions   bigint default 0,
  clicks        bigint default 0,
  spend         numeric(10,2) default 0,
  reach         bigint default 0,
  created_at    timestamptz default now(),
  unique (platform, campaign_id, region, date)
);

-- ─── Tracked Forms ────────────────────────────────────────────────────────────
-- Formulários/eventos de conversão rastreados (equivalente a tracked_products)
-- active = true  → leads deste form aparecem no dashboard
-- active = false → ignorado
create table if not exists tracked_forms (
  id                uuid primary key default gen_random_uuid(),
  client_slug       text not null references clients(slug),
  source            text not null default 'rdstation',
  conversion_event  text not null,             -- nome do evento/formulário
  display_name      text,                      -- nome amigável
  active            boolean not null default false,
  sheet_id          text,                      -- Google Sheets para pesquisa de audiência
  first_seen        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (client_slug, source, conversion_event)
);

-- ─── Campaign Aliases ────────────────────────────────────────────────────────
-- Mapeia utm_campaign "antigos" ou divergentes para a campanha real em ad_campaigns.
-- Resolve casos como "Search_MPT" → "medical-search-mpt", evitando que leads
-- caiam órfãos no ranking só porque a UTM ficou desatualizada na LP/anúncio.
create table if not exists campaign_aliases (
  id                    uuid primary key default gen_random_uuid(),
  client_slug           text not null references clients(slug),
  alias_utm_campaign    text not null,             -- valor exato do utm_campaign que vem no lead
  target_campaign_name  text not null,             -- nome da campanha real em ad_campaigns
  notes                 text,
  created_at            timestamptz default now(),
  unique (client_slug, alias_utm_campaign)
);

-- ─── Event → Campaign Mapping ────────────────────────────────────────────────
-- Quando um lead chega numa LP de campanha SEM utm_source/utm_medium válidos
-- (link compartilhado via WhatsApp, cookie blocker, UTM perdida), esse
-- mapeamento permite atribuí-lo à campanha correta via conversion_event
-- (que é o slug da própria LP). Diferente de campaign_aliases (que corrige
-- utm_campaign divergente), este mapa cobre o caso "lead sem UTM, mas LP
-- pertence à campanha".
create table if not exists event_to_campaign (
  id                    uuid primary key default gen_random_uuid(),
  client_slug           text not null references clients(slug),
  conversion_event      text not null,             -- ex: 'cotacao-volnewmer-2026q2-lp'
  target_campaign_name  text not null,             -- ex: 'medical-volnewmer-conversao-lp'
  notes                 text,
  created_at            timestamptz default now(),
  unique (client_slug, conversion_event)
);

-- ─── Client Budgets ──────────────────────────────────────────────────────────
-- Orçamento mensal por cliente + plataforma + estratégia de distribuição.
-- Usado para o "Pacing do mês" no Overview: compara gasto real com o
-- previsto pela estratégia (linear, front-loaded, back-loaded).
--   front_half_pct: % do orçamento alocado nos primeiros 15 dias do mês.
--     50  = linear        (50/50)
--     55  = front-loaded leve
--     70  = front-loaded forte
--     40  = back-loaded
--     N   = customizado
-- platform: meta | google | total (null/total = orçamento agregado)
create table if not exists client_budgets (
  id              uuid primary key default gen_random_uuid(),
  client_slug     text not null references clients(slug),
  year_month      text not null,                       -- 'YYYY-MM'
  platform        text not null default 'total',       -- meta | google | total
  budget          numeric(10,2) not null,
  front_half_pct  numeric(5,2) not null default 50,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (client_slug, year_month, platform)
);

-- ─── Report Actions ──────────────────────────────────────────────────────────
-- Ações realizadas pelo gestor (novos criativos, otimizações, pausas, etc).
-- São automaticamente injetadas no relatório de qualquer período que cubra
-- a `action_date`, evitando que o gestor tenha que rebuscar e redigitar.
create table if not exists report_actions (
  id            uuid primary key default gen_random_uuid(),
  client_slug   text not null references clients(slug),
  action_date   date not null,                            -- dia em que a ação foi executada
  platform      text,                                     -- meta | google | null (geral)
  campaign_name text,                                     -- opcional, pra ações específicas
  title         text not null,                            -- ex: "Reforço criativo"
  description   text not null,                            -- texto livre que vira bullet no relatório
  created_at    timestamptz default now()
);
create index if not exists idx_report_actions_client_date on report_actions (client_slug, action_date);

-- ─── Keywords (Google Ads) ───────────────────────────────────────────────────
create table if not exists keywords (
  id              uuid primary key default gen_random_uuid(),
  client_slug     text not null references clients(slug),
  campaign_id     text not null,
  campaign_name   text,
  ad_group_id     text not null,
  ad_group_name   text,
  keyword_id      text not null,
  keyword_text    text not null,
  match_type      text,
  date            date not null,
  impressions     bigint default 0,
  clicks          bigint default 0,
  spend           numeric(10,2) default 0,
  conversions     numeric(10,2) default 0,
  created_at      timestamptz default now(),
  unique (keyword_id, date)
);

-- ─── Search Terms (Google Ads) ───────────────────────────────────────────────
create table if not exists search_terms (
  id              uuid primary key default gen_random_uuid(),
  client_slug     text not null references clients(slug),
  campaign_id     text not null,
  campaign_name   text,
  ad_group_id     text,
  ad_group_name   text,
  search_term     text not null,
  keyword_text    text,
  date            date not null,
  impressions     bigint default 0,
  clicks          bigint default 0,
  spend           numeric(10,2) default 0,
  conversions     numeric(10,2) default 0,
  created_at      timestamptz default now(),
  unique (client_slug, campaign_id, search_term, date)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists leads_client_slug_idx        on leads(client_slug);
create index if not exists leads_created_at_idx         on leads(created_at);
create index if not exists leads_converted_at_idx       on leads(converted_at);
create index if not exists leads_utm_medium_idx         on leads(utm_medium);
create index if not exists leads_email_idx              on leads(lead_email);
create index if not exists tracked_forms_client_idx     on tracked_forms(client_slug, active);
create index if not exists ad_campaigns_client_idx      on ad_campaigns(client_slug, date);
create index if not exists ad_sets_client_idx           on ad_sets(client_slug, date);
create index if not exists ad_creatives_client_idx      on ad_creatives(client_slug, date);
create index if not exists ad_regions_client_idx        on ad_regions(client_slug, date);
create index if not exists keywords_client_idx          on keywords(client_slug, date);
create index if not exists search_terms_client_idx      on search_terms(client_slug, date);

-- ─── RLS Policies ─────────────────────────────────────────────────────────────
alter table clients enable row level security;
alter table leads enable row level security;
alter table ad_campaigns enable row level security;
alter table ad_sets enable row level security;
alter table ad_creatives enable row level security;
alter table ad_regions enable row level security;
alter table tracked_forms enable row level security;
alter table keywords enable row level security;
alter table search_terms enable row level security;

create policy "anon read clients"       on clients       for select using (true);
create policy "anon read leads"          on leads          for select using (true);
create policy "anon read ad_campaigns"   on ad_campaigns   for select using (true);
create policy "anon read ad_sets"        on ad_sets        for select using (true);
create policy "anon read ad_creatives"   on ad_creatives   for select using (true);
create policy "anon read ad_regions"     on ad_regions     for select using (true);
create policy "anon read tracked_forms"  on tracked_forms  for select using (true);
create policy "anon read keywords"       on keywords       for select using (true);
create policy "anon read search_terms"   on search_terms   for select using (true);
