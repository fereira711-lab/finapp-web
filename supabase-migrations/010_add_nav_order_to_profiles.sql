-- Ordem personalizada do menu lateral (lista de rotas, na ordem escolhida pelo usuario)
alter table public.profiles add column if not exists nav_order text[];
