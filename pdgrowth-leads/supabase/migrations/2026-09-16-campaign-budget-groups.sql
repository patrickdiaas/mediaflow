-- Migration: tabela pra campanhas com verba separada do orçamento regular
-- (ex: "Keep It Real" em MedSystems/Negócios e Redes, com budget próprio).
--
-- Rodar isso UMA VEZ no SQL Editor do Supabase.

create table if not exists campaign_budget_groups (
  id             uuid primary key default gen_random_uuid(),
  client_slug    text not null references clients(slug),
  campaign_name  text not null,
  group_name     text not null,
  notes          text,
  created_at     timestamptz default now(),
  unique (client_slug, campaign_name)
);

alter table public.campaign_budget_groups enable row level security;
drop policy if exists "anon read" on public.campaign_budget_groups;
create policy "anon read" on public.campaign_budget_groups for select using (true);
