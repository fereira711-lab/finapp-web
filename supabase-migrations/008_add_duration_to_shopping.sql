-- Duracao dos itens de compra: quanto tempo cada item dura e quando foi comprado pela ultima vez
alter table public.shopping_items
  add column if not exists duration_days integer check (duration_days is null or duration_days between 1 and 365),
  add column if not exists last_bought_at date;

-- Dica mostrada na lista da semana (ex.: "Acaba em 3 dias")
alter table public.shopping_list_items
  add column if not exists hint text;
