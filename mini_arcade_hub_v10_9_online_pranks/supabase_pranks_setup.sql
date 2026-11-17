-- Mini Arcade Hub: online presence and admin-only temporary prank events.
-- Run AFTER supabase_setup.sql AND supabase_admin_setup.sql.
-- No service-role key is used by the desktop client.

create table if not exists public.mini_arcade_presence (
    user_id uuid primary key references auth.users(id) on delete cascade,
    username text not null,
    last_seen_at timestamptz not null default now()
);

create table if not exists public.mini_arcade_prank_events (
    id bigint generated always as identity primary key,
    target_user_id uuid not null references auth.users(id) on delete cascade,
    created_by uuid references auth.users(id) on delete set null,
    event_type text not null check (event_type in (
        'jumpscare', 'reality_glitch', 'nickname_swap', 'confetti',
        'fake_announcement', 'duck_invasion', 'fortune'
    )),
    payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '2 minutes'),
    delivered_at timestamptz
);

create index if not exists mini_arcade_presence_last_seen_idx
    on public.mini_arcade_presence(last_seen_at desc);
create index if not exists mini_arcade_prank_pending_idx
    on public.mini_arcade_prank_events(target_user_id, created_at)
    where delivered_at is null;

alter table public.mini_arcade_presence enable row level security;
alter table public.mini_arcade_prank_events enable row level security;
revoke all on public.mini_arcade_presence from anon, authenticated;
revoke all on public.mini_arcade_prank_events from anon, authenticated;

-- Players may only register their own authenticated session as online.
create or replace function public.mini_arcade_prank_heartbeat(p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user uuid := (select auth.uid());
    v_username text;
begin
    if v_user is null then raise exception 'Sign-in required'; end if;
    select l.username into v_username
    from public.leaderboard l where l.user_id = v_user;
    if v_username is null or lower(trim(coalesce(p_username, ''))) <> v_username then
        raise exception 'Username does not match this account';
    end if;
    insert into public.mini_arcade_presence(user_id, username, last_seen_at)
    values (v_user, v_username, now())
    on conflict (user_id) do update
       set username = excluded.username, last_seen_at = excluded.last_seen_at;
end;
$$;

-- A client removes its own presence row on normal sign-out/close.
create or replace function public.mini_arcade_prank_leave()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if (select auth.uid()) is null then raise exception 'Sign-in required'; end if;
    delete from public.mini_arcade_presence where user_id = (select auth.uid());
end;
$$;

-- Only admins/owner can see the online-player list.
create or replace function public.mini_arcade_admin_online_players()
returns table(user_id uuid, username text, last_seen_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if (select auth.uid()) is null then raise exception 'Sign-in required'; end if;
    if coalesce(public.mini_arcade_admin_check(), '') not in ('owner', 'admin') then
        raise exception 'Administrator permission required';
    end if;
    return query
    select p.user_id, p.username, p.last_seen_at
    from public.mini_arcade_presence p
    where p.last_seen_at > now() - interval '90 seconds'
    order by p.username;
end;
$$;

-- Server validates role, event type, online status, and cooldown.
-- Clients cannot choose arbitrary payload text or insert rows directly.
create or replace function public.mini_arcade_admin_send_prank(
    p_target_user_id uuid,
    p_event_type text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor uuid := (select auth.uid());
    v_target_username text;
    v_event_id bigint;
begin
    if v_actor is null then raise exception 'Sign-in required'; end if;
    if coalesce(public.mini_arcade_admin_check(), '') not in ('owner', 'admin') then
        raise exception 'Administrator permission required';
    end if;
    if p_event_type is null or p_event_type not in (
        'jumpscare', 'reality_glitch', 'nickname_swap', 'confetti',
        'fake_announcement', 'duck_invasion', 'fortune'
    ) then
        raise exception 'Unknown prank type';
    end if;
    -- Serialize simultaneous sends so two admins cannot bypass the target cooldown.
    perform pg_advisory_xact_lock(hashtext(p_target_user_id::text)::bigint);
    perform pg_advisory_xact_lock(hashtext(v_actor::text)::bigint);
    select p.username into v_target_username
    from public.mini_arcade_presence p
    where p.user_id = p_target_user_id
      and p.last_seen_at > now() - interval '90 seconds';
    if v_target_username is null then
        raise exception 'That player is no longer online. Refresh the list.';
    end if;
    if exists (
        select 1 from public.mini_arcade_prank_events e
        where e.target_user_id = p_target_user_id
          and e.created_at > now() - interval '15 seconds'
    ) then
        raise exception 'Please wait 15 seconds before pranking this player again';
    end if;
    if exists (
        select 1 from public.mini_arcade_prank_events e
        where e.created_by = v_actor
          and e.created_at > now() - interval '2 seconds'
    ) then
        raise exception 'Please wait a moment before sending another prank';
    end if;
    insert into public.mini_arcade_prank_events
        (target_user_id, created_by, event_type, payload, expires_at)
    values (p_target_user_id, v_actor, p_event_type, '{}'::jsonb, now() + interval '2 minutes')
    returning id into v_event_id;
    insert into public.mini_arcade_admin_audit
        (actor_user_id, action, target_user_id, target_username, details)
    values (v_actor, 'prank_' || p_event_type, p_target_user_id, v_target_username,
            jsonb_build_object('event_id', v_event_id));
    return v_event_id;
end;
$$;

-- A signed-in player can only claim events addressed to their own Auth UUID.
-- Claiming marks each event delivered atomically so it is not replayed on every poll.
create or replace function public.mini_arcade_prank_poll()
returns table(event_id bigint, event_type text, payload jsonb)
language plpgsql
security definer
set search_path = ''
as $$
begin
    if (select auth.uid()) is null then raise exception 'Sign-in required'; end if;
    return query
    with picked as (
        select e.id
        from public.mini_arcade_prank_events e
        where e.target_user_id = (select auth.uid())
          and e.delivered_at is null
          and e.expires_at > now()
        order by e.created_at
        limit 5
        for update skip locked
    ), claimed as (
        update public.mini_arcade_prank_events e
        set delivered_at = now()
        from picked p
        where e.id = p.id
        returning e.id, e.event_type, e.payload
    )
    select c.id, c.event_type, c.payload from claimed c;
end;
$$;

revoke all on function public.mini_arcade_prank_heartbeat(text) from public, anon;
revoke all on function public.mini_arcade_prank_leave() from public, anon;
revoke all on function public.mini_arcade_admin_online_players() from public, anon;
revoke all on function public.mini_arcade_admin_send_prank(uuid, text) from public, anon;
revoke all on function public.mini_arcade_prank_poll() from public, anon;
grant execute on function public.mini_arcade_prank_heartbeat(text) to authenticated;
grant execute on function public.mini_arcade_prank_leave() to authenticated;
grant execute on function public.mini_arcade_admin_online_players() to authenticated;
grant execute on function public.mini_arcade_admin_send_prank(uuid, text) to authenticated;
grant execute on function public.mini_arcade_prank_poll() to authenticated;

-- Expired events are ignored by clients; periodically clear old rows if desired:
-- delete from public.mini_arcade_prank_events where expires_at < now() - interval '1 day';
-- delete from public.mini_arcade_presence where last_seen_at < now() - interval '7 days';
