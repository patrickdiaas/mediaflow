-- ============================================================
-- PD Growth Vendas — Row Level Security (RLS)
-- Execute no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/vaioizdzuatfvqaaxble/sql
-- ============================================================

-- ─── Habilitar RLS em todas as tabelas ───────────────────────────────────────
alter table clients          enable row level security;
alter table sales            enable row level security;
alter table tracked_products enable row level security;
alter table ad_campaigns     enable row level security;
alter table ad_sets          enable row level security;
alter table ad_creatives     enable row level security;

-- ─── clients ─────────────────────────────────────────────────────────────────
-- Anon pode ler (necessário para o selector de cliente no sidebar)
create policy "anon_read_clients"
  on clients for select
  to anon
  using (true);

-- ─── sales ───────────────────────────────────────────────────────────────────
-- Anon pode ler (dashboard lê direto via supabase client)
create policy "anon_read_sales"
  on sales for select
  to anon
  using (true);

-- Somente service_role pode escrever (webhooks usam service role)
-- Nenhuma policy de INSERT/UPDATE/DELETE para anon = bloqueado por padrão

-- ─── tracked_products ────────────────────────────────────────────────────────
create policy "anon_read_tracked_products"
  on tracked_products for select
  to anon
  using (true);

-- ─── ad_campaigns ────────────────────────────────────────────────────────────
create policy "anon_read_ad_campaigns"
  on ad_campaigns for select
  to anon
  using (true);

-- ─── ad_sets ─────────────────────────────────────────────────────────────────
create policy "anon_read_ad_sets"
  on ad_sets for select
  to anon
  using (true);

-- ─── ad_creatives ────────────────────────────────────────────────────────────
create policy "anon_read_ad_creatives"
  on ad_creatives for select
  to anon
  using (true);

-- ─── Resultado esperado ──────────────────────────────────────────────────────
-- anon key  → só leitura (SELECT) em todas as tabelas
-- service_role → acesso total (bypassa RLS) — usado nos webhooks e sync jobs
-- Qualquer tentativa de INSERT/UPDATE/DELETE via anon key → erro 403
