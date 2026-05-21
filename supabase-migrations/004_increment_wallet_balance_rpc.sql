-- Garante unicidade da carteira por usuario (case insensitive)
create unique index if not exists accounts_user_carteira_unique
  on public.accounts (user_id)
  where lower(name) = 'carteira';

-- Increment atomico do saldo da carteira. Cria carteira se nao existir.
-- Usa security invoker + RLS valida que user_id = auth.uid().
create or replace function public.increment_wallet_balance(p_delta numeric)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_new_balance numeric;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  -- Tenta update atomico
  update public.accounts
  set balance = balance + p_delta
  where user_id = v_user_id
    and lower(name) = 'carteira'
  returning balance into v_new_balance;

  if not found then
    -- Carteira nao existe, cria com delta como saldo inicial
    insert into public.accounts (user_id, name, bank_name, account_type, balance)
    values (v_user_id, 'Carteira', 'Manual', 'checking', p_delta)
    returning balance into v_new_balance;
  end if;

  return v_new_balance;
end;
$$;

grant execute on function public.increment_wallet_balance(numeric) to authenticated;
