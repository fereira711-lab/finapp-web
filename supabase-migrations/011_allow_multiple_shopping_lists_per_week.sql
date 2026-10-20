-- Mais de uma compra na mesma semana: remove a trava "uma lista por semana".
-- Cada compra continua sendo uma lista (shopping_lists); a tela mostra a mais recente da semana.
alter table public.shopping_lists
  drop constraint if exists shopping_lists_user_id_week_start_key;
