alter table public.goals
  add column if not exists position integer;

-- backfill: ordem atual (created_at) por usuario
update public.goals g
set position = r.rn
from (
  select id, row_number() over (partition by user_id order by created_at) - 1 as rn
  from public.goals
) r
where g.id = r.id and g.position is null;
