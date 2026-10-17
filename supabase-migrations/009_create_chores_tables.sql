-- Casa: tarefas da casa (fixas ou automaticas), rotina pessoal e registro do que foi feito

create table if not exists public.chore_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  color text not null default '#6366F1',
  mode text not null default 'fixed' check (mode in ('fixed', 'auto')),
  -- fixa: dias da semana (0=dom..6=sab) e/ou dias do mes, horario e duracao
  weekdays integer[] not null default '{}',
  month_days integer[] not null default '{}',
  start_time text,
  duration_min integer not null default 60 check (duration_min between 5 and 1440),
  -- automatica: tempo por semana dividido em blocos, encaixados nos horarios livres
  weekly_min integer check (weekly_min between 5 and 10080),
  block_min integer check (block_min between 5 and 1440),
  -- a tarefa so vale a partir desta data (evita "atrasadas" de antes de existir)
  starts_on date not null default current_date,
  position integer,
  created_at timestamptz default now()
);

create table if not exists public.chore_routine (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  work_start text,
  work_end text,
  other_start text,
  other_end text,
  avail_start text,
  avail_end text,
  unique (user_id, weekday)
);

-- uma linha por tarefa/bloco feito; desmarcar apaga a linha
create table if not exists public.chore_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid not null references public.chore_tasks(id) on delete cascade,
  slot text not null default 'f',
  log_date date not null,
  planned_start text,
  planned_min integer,
  real_min integer,
  created_at timestamptz default now(),
  unique (task_id, slot, log_date)
);

create index if not exists chore_logs_user_date_idx on public.chore_logs(user_id, log_date);
create index if not exists chore_tasks_user_idx on public.chore_tasks(user_id, position);

alter table public.chore_tasks enable row level security;
alter table public.chore_routine enable row level security;
alter table public.chore_logs enable row level security;

create policy "users_own_chore_tasks" on public.chore_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users_own_chore_routine" on public.chore_routine
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users_own_chore_logs" on public.chore_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
