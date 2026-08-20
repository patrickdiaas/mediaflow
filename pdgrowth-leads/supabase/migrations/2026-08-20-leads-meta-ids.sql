-- Migration: adiciona colunas de IDs Meta na tabela leads pra atribuição exata
-- (Solução 2 do problema de duplicação de ad_name entre conjuntos)
--
-- Rodar isso UMA VEZ no SQL Editor do Supabase.

-- 1. Colunas novas (nullable — só populado pra meta_leadform / meta_whatsapp)
alter table leads add column if not exists meta_ad_id text;
alter table leads add column if not exists meta_adset_id text;
alter table leads add column if not exists meta_campaign_id text;

-- 2. Índice pra lookup rápido por ad_id no relatório
create index if not exists idx_leads_meta_ad_id on leads (meta_ad_id) where meta_ad_id is not null;

-- 3. Backfill: extrai IDs do raw_payload dos leads meta_leadform + meta_whatsapp existentes
update leads
set
  meta_ad_id       = coalesce(meta_ad_id,       raw_payload->>'ad_id'),
  meta_adset_id    = coalesce(meta_adset_id,    raw_payload->>'adset_id'),
  meta_campaign_id = coalesce(meta_campaign_id, raw_payload->>'campaign_id')
where source in ('meta_leadform', 'meta_whatsapp')
  and raw_payload is not null;

-- Verificação: quantos leads foram atualizados
-- select source, count(*) filter (where meta_ad_id is not null) as com_ad_id,
--        count(*) as total
-- from leads where source in ('meta_leadform','meta_whatsapp') group by source;
