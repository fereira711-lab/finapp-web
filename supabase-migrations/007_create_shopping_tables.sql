-- Compras semanais: itens fixos, listas por semana e itens de cada lista

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  category text not null default 'mercearia',
  qty text not null default '1 un',
  estimated_price numeric(10,2) not null default 0,
  position integer,
  created_at timestamptz default now()
);

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  budget numeric(10,2) not null default 400,
  status text not null default 'open' check (status in ('open', 'done')),
  total numeric(10,2),
  transaction_id uuid,
  finished_at timestamptz,
  created_at timestamptz default now(),
  unique (user_id, week_start)
);

create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid references public.shopping_items(id) on delete set null,
  name text not null,
  category text not null default 'mercearia',
  qty text not null default '1 un',
  estimated_price numeric(10,2) not null default 0,
  price numeric(10,2),
  checked boolean not null default false,
  position integer,
  created_at timestamptz default now()
);

create index if not exists shopping_list_items_list_idx on public.shopping_list_items(list_id);
create index if not exists shopping_lists_user_week_idx on public.shopping_lists(user_id, week_start desc);

alter table public.shopping_items enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;

create policy "users_own_shopping_items" on public.shopping_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users_own_shopping_lists" on public.shopping_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users_own_shopping_list_items" on public.shopping_list_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
