-- Mini Arcade Hub v10.11: TRIVIA - one game per day (decided by the SERVER's clock) and a maximum bet.
-- Safe to run more than once. Run in Supabase -> SQL Editor, after supabase_setup.sql,
-- supabase_moderation_setup.sql and supabase_security_hardening_v2.sql (it uses the suspension check).
--
-- How it works
--   * Starting a trivia game calls mini_arcade_trivia_start(bet). The SERVER looks at its own
--     clock, works out today's date, and writes one row for (this player, today). A player can
--     only ever have one row per day, so a second start on the same day is refused - no matter
--     what time the player's own computer or phone says, and no matter which device they use.
--   * mini_arcade_trivia_status() tells the game whether the player may play and how many
--     seconds remain until the next game. The game counts those seconds down itself, so changing
--     the local clock cannot unlock anything.
--   * The maximum bet (2,500) is also enforced here: a start request above it is refused.
--   * Players cannot read or write the table directly; they can only use the two functions.
--
-- Changing the rules later (edit, then run this script again):
--   * Day boundary: the timezone in mini_arcade_trivia_reset_timezone() below. It is 'UTC', which
--     means a new day starts at midnight UTC (4 PM or 5 PM in California). To reset at midnight
--     Pacific time, change 'UTC' to 'America/Los_Angeles'.
--   * Maximum bet: c_max_bet in mini_arcade_trivia_start() and mini_arcade_trivia_status().
--     Change the number in BOTH, and change TRIVIA_MAX_BET in the game too (web
--     src/games/trivia/engine.js and desktop trivia_daily.py) so the game shows the same limit.
--
-- Honest limits
--   * The server decides WHEN a game may start and records the bet it was told about. It does not
--     see the questions, the answers or the payout: those are worked out on the player's own
--     device, like every other game here. The server also does not check the bet against the
--     player's balance (the balance lives in the player's own save). This is a fairness rule for
--     friends, not cheat-proof.
--   * A game counts as played the moment it starts. Closing the game halfway through does not give
--     the day back.

-- ---------------------------------------------------------------------------
-- 1. One row per player per day (players have no direct access)
-- ---------------------------------------------------------------------------
create table if not exists public.mini_arcade_trivia_plays (
    user_id uuid not null references auth.users (id) on delete cascade,
    play_day date not null,
    bet integer not null default 0 check (bet >= 0),
    started_at timestamptz not null default now(),
    primary key (user_id, play_day)
);

alter table public.mini_arcade_trivia_plays enable row level security;
revoke all on table public.mini_arcade_trivia_plays from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The day boundary
-- ---------------------------------------------------------------------------
create or replace function public.mini_arcade_trivia_reset_timezone()
returns text
language sql
immutable
set search_path = ''
as $$
    select 'UTC'::text;
$$;

revoke all on function public.mini_arcade_trivia_reset_timezone() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Status: may I play today, and how long until I can?
-- ---------------------------------------------------------------------------
create or replace function public.mini_arcade_trivia_status()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    c_max_bet constant integer := 2500;
    v_user_id uuid := (select auth.uid());
    v_tz text := public.mini_arcade_trivia_reset_timezone();
    v_today date := (now() at time zone public.mini_arcade_trivia_reset_timezone())::date;
    v_next_reset timestamptz;
    v_played boolean;
begin
    if v_user_id is null then
        raise exception 'Sign-in required';
    end if;
    if public.mini_arcade_caller_is_suspended() then
        raise exception 'This account is suspended';
    end if;

    v_next_reset := ((v_today + 1)::timestamp) at time zone v_tz;
    v_played := exists (
        select 1 from public.mini_arcade_trivia_plays as p
        where p.user_id = v_user_id and p.play_day = v_today
    );

    return json_build_object(
        'can_play', not v_played,
        'play_day', v_today,
        'server_time', now(),
        'next_reset_at', v_next_reset,
        'seconds_until_reset', greatest(ceil(extract(epoch from (v_next_reset - now())))::integer, 0),
        'max_bet', c_max_bet
    );
end;
$$;

revoke all on function public.mini_arcade_trivia_status() from public, anon;
grant execute on function public.mini_arcade_trivia_status() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Start today's game (this is what uses up the day)
-- ---------------------------------------------------------------------------
-- Returns {"ok": true, ...} when the game may start, or {"ok": false, "reason": "already_played", ...}
-- when today's game was already used. A bet that is not a whole number from 0 to 2,500 is an error.
create or replace function public.mini_arcade_trivia_start(p_bet integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
    c_max_bet constant integer := 2500;
    v_user_id uuid := (select auth.uid());
    v_tz text := public.mini_arcade_trivia_reset_timezone();
    v_today date := (now() at time zone public.mini_arcade_trivia_reset_timezone())::date;
    v_next_reset timestamptz;
    v_rows integer;
begin
    if v_user_id is null then
        raise exception 'Sign-in required';
    end if;
    if public.mini_arcade_caller_is_suspended() then
        raise exception 'This account is suspended';
    end if;
    if p_bet is null or p_bet < 0 or p_bet > c_max_bet then
        raise exception 'The bet must be a whole number from 0 to %', c_max_bet;
    end if;

    v_next_reset := ((v_today + 1)::timestamp) at time zone v_tz;

    -- The primary key makes this atomic: if two requests arrive together, only one row is written.
    insert into public.mini_arcade_trivia_plays (user_id, play_day, bet)
    values (v_user_id, v_today, p_bet)
    on conflict (user_id, play_day) do nothing;
    get diagnostics v_rows = row_count;

    return json_build_object(
        'ok', v_rows = 1,
        'reason', case when v_rows = 1 then null else 'already_played' end,
        'can_play', false,
        'play_day', v_today,
        'server_time', now(),
        'next_reset_at', v_next_reset,
        'seconds_until_reset', greatest(ceil(extract(epoch from (v_next_reset - now())))::integer, 0),
        'max_bet', c_max_bet,
        'bet', case when v_rows = 1 then p_bet else null end
    );
end;
$$;

revoke all on function public.mini_arcade_trivia_start(integer) from public, anon;
grant execute on function public.mini_arcade_trivia_start(integer) to authenticated;
