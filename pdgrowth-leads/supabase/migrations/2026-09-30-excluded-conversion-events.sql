-- Migration: lista global de conversion_events a EXCLUIR por completo dos KPIs
-- de leads/CPL (não é "verba separada" — é lixo/terceiro, nunca deve contar).
-- Caso real: campanha de Lead Ads de outra agência (programática) rodando com
-- UTM nunca configurada ("medical-[produto/institucional]-lead-ads - 11.09.26"),
-- identificada em 30/09/2026 — não é mídia do PD Growth, mas passava no filtro
-- de "lead pago" (utm_medium=cpc) e inflava o total de Leads/CPL em todas as
-- telas (Overview, Campanhas, Relatórios), mesmo sem aparecer na tabela de
-- campanhas (não batia com nenhum campaign_name real).
--
-- Rodar isso UMA VEZ no SQL Editor do Supabase.

create table if not exists excluded_conversion_events (
  id                uuid primary key default gen_random_uuid(),
  conversion_event  text not null unique,
  reason            text,
  created_at        timestamptz default now()
);

alter table public.excluded_conversion_events enable row level security;
drop policy if exists "anon read" on public.excluded_conversion_events;
create policy "anon read" on public.excluded_conversion_events for select using (true);

insert into excluded_conversion_events (conversion_event, reason) values
  ('medical-[produto/institucional]-lead-ads - 11.09.26', 'Campanha de Lead Ads de outra agência (programática) com UTM/form nunca configurado — placeholder não preenchido. Não é mídia do PD Growth. Identificado 30/09/2026.'),
  ('medical-[produto/institucional]-lead-ads', 'Variante sem sufixo de data do mesmo problema acima.'),
  ('bts-[produto/institucional]-lead-ads', 'Variante "bts-" do mesmo problema acima.')
on conflict (conversion_event) do nothing;
