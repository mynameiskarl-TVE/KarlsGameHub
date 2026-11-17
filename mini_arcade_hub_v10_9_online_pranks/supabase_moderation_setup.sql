-- Mini Arcade Hub: server-enforced leaderboard moderation. Safe to run more than once.
-- Run AFTER supabase_setup.sql and supabase_admin_setup.sql in Supabase -> SQL Editor.
--
-- Scores are reported by each player's own computer, so the server cannot prove they are honest.
-- This script gives the owner and admins a server-side way to deal with a cheater: a SUSPENDED
-- player disappears from the leaderboard and the server ignores their score updates.
-- It does not delete the account or stop them from playing offline.

alter table public.leaderboard
    add column if not exists is_suspended boolean not null default false,
    add column if not exists suspended_reason text,
    add column if not exists suspended_at timestamptz;

alter table public.leaderboard
    drop constraint if exists leaderboard_suspended_reason_length;
alter table public.leaderboard
    add constraint leaderboard_suspended_reason_length
    check (suspended_reason is null or char_length(suspended_reason) <= 200);

-- The existing column-level UPDATE grant lists only nickname/points/wins columns, so players
-- still cannot write the three suspension columns above. These policies make the server
-- ignore score updates from suspended players and hide suspended rows from everyone.
drop policy if exists "Signed-in players can read leaderboard" on public.leaderboard;
create policy "Signed-in players can read leaderboard"
    on public.leaderboard for select to authenticated
    using ((select auth.uid()) is not null and not is_suspended);

drop policy if exists "Players can update their own leaderboard row" on public.leaderboard;
create policy "Players can update their own leaderboard row"
    on public.leaderboard for update to authenticated
    using ((select auth.uid()) = user_id and not is_suspended)
    with check ((select auth.uid()) = user_id and not is_suspended);

-- Suspend a player. Owner and admins only. Only the owner may suspend an administrator,
-- and the permanent owner and your own account can never be suspended.
create or replace function public.mini_arcade_admin_suspend_player(
    p_username text,
    p_reason text default '',
    p_reset_score boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor_id uuid := (select auth.uid());
    actor_role text := public.mini_arcade_admin_check();
    clean_username text := lower(trim(coalesce(p_username, '')));
    clean_reason text := left(trim(coalesce(p_reason, '')), 200);
    do_reset boolean := coalesce(p_reset_score, true);
    target_id uuid;
    target_role text;
begin
    if coalesce(actor_role, '') not in ('owner', 'admin') then
        raise exception 'Administrator permission required';
    end if;
    if clean_username !~ '^[a-z0-9_]{3,20}$' then
        raise exception 'Invalid username';
    end if;

    select l.user_id into target_id
    from public.leaderboard as l where l.username = clean_username;
    if target_id is null then
        raise exception 'Account username not found';
    end if;
    if target_id = actor_id then
        raise exception 'You cannot suspend your own account';
    end if;

    select r.role into target_role
    from public.mini_arcade_admin_roles as r where r.user_id = target_id;
    if target_role = 'owner' then
        raise exception 'The permanent owner cannot be suspended';
    end if;
    if target_role = 'admin' and actor_role <> 'owner' then
        raise exception 'Only the owner can suspend an administrator';
    end if;

    update public.leaderboard
    set is_suspended = true,
        suspended_reason = nullif(clean_reason, ''),
        suspended_at = now(),
        nickname = case when do_reset then username else nickname end,
        points = case when do_reset then 500 else points end,
        total_wins = case when do_reset then 0 else total_wins end,
        blackjack_wins = case when do_reset then 0 else blackjack_wins end,
        mini_game_wins = case when do_reset then 0 else mini_game_wins end,
        trivia_correct = case when do_reset then 0 else trivia_correct end
    where user_id = target_id;

    insert into public.mini_arcade_admin_audit
        (actor_user_id, action, target_user_id, target_username, details)
    values (actor_id, 'suspend_player', target_id, clean_username,
            jsonb_build_object('reason', clean_reason, 'reset_score', do_reset));
end;
$$;

create or replace function public.mini_arcade_admin_unsuspend_player(p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor_id uuid := (select auth.uid());
    actor_role text := public.mini_arcade_admin_check();
    clean_username text := lower(trim(coalesce(p_username, '')));
    target_id uuid;
    target_role text;
begin
    if coalesce(actor_role, '') not in ('owner', 'admin') then
        raise exception 'Administrator permission required';
    end if;
    if clean_username !~ '^[a-z0-9_]{3,20}$' then
        raise exception 'Invalid username';
    end if;

    select l.user_id into target_id
    from public.leaderboard as l where l.username = clean_username;
    if target_id is null then
        raise exception 'Account username not found';
    end if;

    select r.role into target_role
    from public.mini_arcade_admin_roles as r where r.user_id = target_id;
    if target_role = 'admin' and actor_role <> 'owner' then
        raise exception 'Only the owner can change an administrator';
    end if;

    update public.leaderboard
    set is_suspended = false, suspended_reason = null, suspended_at = null
    where user_id = target_id;

    insert into public.mini_arcade_admin_audit
        (actor_user_id, action, target_user_id, target_username, details)
    values (actor_id, 'unsuspend_player', target_id, clean_username, '{}'::jsonb);
end;
$$;

create or replace function public.mini_arcade_admin_list_suspended()
returns table (username text, reason text, suspended_at timestamptz)
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
    select l.username, l.suspended_reason, l.suspended_at
    from public.leaderboard as l
    where l.is_suspended
    order by l.suspended_at desc nulls last
    limit 100;
end;
$$;

revoke all on function public.mini_arcade_admin_suspend_player(text, text, boolean) from public, anon;
revoke all on function public.mini_arcade_admin_unsuspend_player(text) from public, anon;
revoke all on function public.mini_arcade_admin_list_suspended() from public, anon;
grant execute on function public.mini_arcade_admin_suspend_player(text, text, boolean) to authenticated;
grant execute on function public.mini_arcade_admin_unsuspend_player(text) to authenticated;
grant execute on function public.mini_arcade_admin_list_suspended() to authenticated;

-- Lets a signed-in player ask about THEIR OWN suspension status. Needed because the policy
-- above hides a suspended player's leaderboard row from them, so the game cannot read it.
-- It only ever returns the caller's own row, and nothing about anyone else.
create or replace function public.mini_arcade_my_status()
returns table (is_suspended boolean, reason text)
language sql
stable
security definer
set search_path = ''
as $$
    select l.is_suspended, l.suspended_reason
    from public.leaderboard as l
    where l.user_id = (select auth.uid());
$$;

revoke all on function public.mini_arcade_my_status() from public, anon;
grant execute on function public.mini_arcade_my_status() to authenticated;
