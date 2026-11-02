-- Run once in the catering Supabase project's SQL editor.
-- This migration creates new tables only; it does not import browser demo data.
begin;

create table public.catering_workspaces (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null default '{"settings":{"businessName":"My Catering Kitchen","currency":"USD","phone":"","address":""},"categories":[],"customers":[],"menuItems":[],"orders":[],"payments":[]}'::jsonb,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  constraint catering_workspace_shape check (
    jsonb_typeof(data) = 'object'
    and data ?& array['settings','categories','customers','menuItems','orders','payments']
    and jsonb_typeof(data->'settings') = 'object'
    and jsonb_typeof(data->'categories') = 'array'
    and jsonb_typeof(data->'customers') = 'array'
    and jsonb_typeof(data->'menuItems') = 'array'
    and jsonb_typeof(data->'orders') = 'array'
    and jsonb_typeof(data->'payments') = 'array'
  )
);

alter table public.catering_workspaces enable row level security;

revoke all on table public.catering_workspaces from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on table public.catering_workspaces to authenticated;
grant insert (user_id) on table public.catering_workspaces to authenticated;
grant update (data) on table public.catering_workspaces to authenticated;

create policy catering_workspace_read_own on public.catering_workspaces
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy catering_workspace_create_own on public.catering_workspaces
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy catering_workspace_update_own on public.catering_workspaces
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create function public.catering_workspace_revision()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'A workspace cannot change account owner';
  end if;
  new.revision := old.revision + 1;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
revoke all on function public.catering_workspace_revision() from public, anon, authenticated;

create trigger catering_workspace_revision_before_update
  before update on public.catering_workspaces
  for each row execute function public.catering_workspace_revision();

comment on table public.catering_workspaces is
  'One private catering workspace per Supabase Auth user. RLS isolates accounts; revision prevents stale-device overwrites.';

commit;
