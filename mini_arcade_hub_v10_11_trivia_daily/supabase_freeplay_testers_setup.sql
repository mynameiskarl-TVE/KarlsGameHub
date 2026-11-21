-- Add owner-managed free-play tester access for the browser arcade.
-- Testers can play Blackjack and Slots without coin deductions or payouts.
-- The grant is stored server-side and cannot be self-assigned by browser clients.

create table if not exists public.mini_arcade_freeplay_testers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.mini_arcade_freeplay_testers enable row level security;
revoke all on table public.mini_arcade_freeplay_testers from public, anon, authenticated;

create or replace function public.mini_arcade_freeplay_check()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.mini_arcade_freeplay_testers t
    where t.user_id = (select auth.uid())
  );
$$;

create or replace function public.mini_arcade_admin_list_freeplay_testers()
returns table (username text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(public.mini_arcade_admin_check(), '') not in ('owner', 'admin') then
    raise exception 'Administrator permission required';
  end if;
  return query
  select l.username, t.created_at
  from public.mini_arcade_freeplay_testers t
  join public.leaderboard l on l.user_id = t.user_id
  order by l.username;
end;
$$;

create or replace function public.mini_arcade_admin_set_freeplay_tester(p_username text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_id uuid;
  clean_username text := lower(trim(coalesce(p_username, '')));
begin
  if public.mini_arcade_admin_check() is distinct from 'owner' then
    raise exception 'Only the permanent owner can manage tester access';
  end if;
  if clean_username !~ '^[a-z0-9_]{3,20}$' then raise exception 'Invalid username'; end if;
  if p_enabled is null then raise exception 'Tester access action is required'; end if;

  select l.user_id into target_id from public.leaderboard l
  where l.username = clean_username limit 1;
  if target_id is null then raise exception 'Account username not found'; end if;

  if p_enabled then
    insert into public.mini_arcade_freeplay_testers (user_id, granted_by)
    values (target_id, actor_id)
    on conflict (user_id) do update set granted_by = excluded.granted_by;
    insert into public.mini_arcade_admin_audit (actor_user_id, action, target_user_id, target_username, details)
    values (actor_id, 'grant_freeplay_tester', target_id, clean_username, '{"free_play":true}'::jsonb);
  else
    delete from public.mini_arcade_freeplay_testers where user_id = target_id;
    insert into public.mini_arcade_admin_audit (actor_user_id, action, target_user_id, target_username, details)
    values (actor_id, 'revoke_freeplay_tester', target_id, clean_username, '{"free_play":false}'::jsonb);
  end if;
end;
$$;

revoke all on function public.mini_arcade_freeplay_check() from public, anon;
revoke all on function public.mini_arcade_admin_list_freeplay_testers() from public, anon;
revoke all on function public.mini_arcade_admin_set_freeplay_tester(text, boolean) from public, anon;
grant execute on function public.mini_arcade_freeplay_check() to authenticated;
grant execute on function public.mini_arcade_admin_list_freeplay_testers() to authenticated;
grant execute on function public.mini_arcade_admin_set_freeplay_tester(text, boolean) to authenticated;
