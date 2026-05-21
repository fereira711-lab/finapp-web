alter table public.profiles
  add column if not exists receive_dates jsonb not null default '[]'::jsonb;
