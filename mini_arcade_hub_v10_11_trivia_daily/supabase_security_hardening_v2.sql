-- Mini Arcade Hub: security hardening v2. Safe to run more than once.
-- Run AFTER every earlier supabase_*.sql script (setup, admin, moderation, coin generator,
-- freeplay testers, pranks, blackjack leaderboard, security hardening), in Supabase -> SQL Editor.
--
-- What this script changes:
--   1. A suspended player can no longer write their cloud save or trigger a leaderboard sync.
--      (Before, only the browser/desktop app stopped them; the server did not.)
--   2. Players can edit only their nickname on the leaderboard (score columns are server-written),
--      and leaderboard points and Blackjack wins can only GROW at a limited speed, no matter what the
--      player's save says. A forged save with 1,000,000,000 points no longer jumps to the top.
--   3. The admin coin generator no longer breaks on a corrupted save balance, and a delegated
--      admin can no longer add coins to their OWN account (the owner still can).
--
-- Honest limit: scores still come from the player's own device, so this is a SPEED LIMIT on
-- cheating, not proof that a score is honest. Do not tie points to anything of real value.

-- ---------------------------------------------------------------------------
-- 1. Suspension enforced by the server
-- ---------------------------------------------------------------------------
-- A suspended player's leaderboard row is hidden from them by Row Level Security, so a policy
-- cannot simply look the row up. This SECURITY DEFINER helper can, and returns only a yes/no
-- about the caller's own account.
create or replace function public.mini_arcade_caller_is_suspended()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(
        (select l.is_suspended from public.leaderboard as l where l.user_id = (select auth.uid())),
        false
    );
$$;

revoke all on function public.mini_arcade_caller_is_suspended() from public, anon;
grant execute on function public.mini_arcade_caller_is_suspended() to authenticated;

drop policy if exists "Players can create their own save" on public.player_saves;
create policy "Players can create their own save"
    on public.player_saves for insert to authenticated
    with check (
        (select auth.uid()) = user_id
        and not (select public.mini_arcade_caller_is_suspended())
    );

drop policy if exists "Players can update their own save" on public.player_saves;
create policy "Players can update their own save"
    on public.player_saves for update to authenticated
    using (
        (select auth.uid()) = user_id
        and not (select public.mini_arcade_caller_is_suspended())
    )
    with check (
        (select auth.uid()) = user_id
        and not (select public.mini_arcade_caller_is_suspended())
    );

-- ---------------------------------------------------------------------------
-- 2. Leaderboard growth speed limit
-- ---------------------------------------------------------------------------
-- Players may change ONLY their display nickname directly. Every score column is written by the
-- server (the sync function below and the admin functions). This matches what the live project
-- already allows; running it again is harmless and also repairs any project set up from an older
-- supabase_setup.sql that still let players write score columns.
revoke update on table public.leaderboard from authenticated;
grant update (nickname) on table public.leaderboard to authenticated;

-- When the server last looked at this player's reported score. Players cannot write it:
-- the column-level UPDATE grant on public.leaderboard lists only nickname and the score columns,
-- and the score columns are not writable by players either (see supabase_security_check.sql).
alter table public.leaderboard
    add column if not exists score_checked_at timestamptz not null default now();

-- Same name, arguments and return type as before, so the web app needs no change.
-- Reads the caller's own save, then copies Blackjack wins and the balance to the caller's own
-- leaderboard row, but never faster than the limits below.
--   * Going DOWN is always accepted.
--   * Going UP is limited to (seconds since the last sync) x (rate), with at most one hour of
--     "saved up" time, so a long break cannot be banked into one huge jump.
--   * A claim above the limit is not an error: the leaderboard simply rises to the limit now and
--     catches up on later syncs. Nobody sees a failed save.
-- To change the limits, edit the four constants below and run this script again.
create or replace function public.mini_arcade_sync_blackjack_wins()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    c_points_per_second constant numeric := 50;     -- points the leaderboard may gain per second
    c_wins_per_second   constant numeric := 0.25;   -- Blackjack wins it may gain per second
    c_max_banked_seconds constant numeric := 3600;  -- longest break that still counts as time

    v_user_id uuid := (select auth.uid());
    v_raw_wins text;
    v_raw_points text;
    v_save_wins bigint;
    v_save_points bigint;
    v_cur_wins bigint;
    v_cur_points bigint;
    v_checked_at timestamptz;
    v_suspended boolean;
    v_elapsed numeric;
    v_new_wins bigint;
    v_new_points bigint;
begin
    if v_user_id is null then
        raise exception 'Sign-in required';
    end if;

    select l.blackjack_wins, l.points, l.score_checked_at, l.is_suspended
      into v_cur_wins, v_cur_points, v_checked_at, v_suspended
    from public.leaderboard as l
    where l.user_id = v_user_id
    for update;

    if not found then
        raise exception 'Leaderboard account not found';
    end if;
    if v_suspended then
        raise exception 'This account is suspended';
    end if;

    select s.save_data ->> 'blackjack_wins',
           s.save_data ->> 'balance'
      into v_raw_wins, v_raw_points
    from public.player_saves as s
    where s.user_id = v_user_id;

    if v_raw_wins is null or v_raw_wins !~ '^[0-9]{1,10}$' then
        v_save_wins := 0;
    else
        v_save_wins := least(v_raw_wins::bigint, 1000000000);
    end if;

    if v_raw_points ~ '^[0-9]{1,10}$' and v_raw_points::bigint <= 1000000000 then
        v_save_points := v_raw_points::bigint;
    else
        v_save_points := v_cur_points;  -- missing or invalid balance: leave the points alone
    end if;

    v_elapsed := least(greatest(extract(epoch from (now() - v_checked_at)), 0), c_max_banked_seconds);

    v_new_wins := case
        when v_save_wins <= v_cur_wins then v_save_wins
        else least(v_save_wins, v_cur_wins + floor(v_elapsed * c_wins_per_second)::bigint)
    end;
    v_new_points := case
        when v_save_points <= v_cur_points then v_save_points
        else least(v_save_points, v_cur_points + floor(v_elapsed * c_points_per_second)::bigint)
    end;

    update public.leaderboard
       set blackjack_wins = v_new_wins,
           points = v_new_points,
           score_checked_at = now()
     where user_id = v_user_id;

    return v_new_wins;
end;
$$;

revoke all on function public.mini_arcade_sync_blackjack_wins() from public, anon;
grant execute on function public.mini_arcade_sync_blackjack_wins() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Admin coin generator: tolerate a corrupted save balance, no self-grants for delegated admins
-- ---------------------------------------------------------------------------
create or replace function public.mini_arcade_admin_spawn_coins(
    p_username text,
    p_amount bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor uuid := (select auth.uid());
    v_actor_role text := public.mini_arcade_admin_check();
    v_target uuid;
    v_username text := lower(trim(coalesce(p_username, '')));
    v_board_points bigint;
    v_raw_balance text;
    v_has_save boolean;
    v_current_balance bigint;
    v_new_balance bigint;
begin
    if v_actor is null then
        raise exception 'Sign-in required';
    end if;
    if coalesce(v_actor_role, '') not in ('owner', 'admin') then
        raise exception 'Administrator permission required';
    end if;
    if v_username !~ '^[a-z0-9_]{3,20}$' then
        raise exception 'Invalid username';
    end if;
    if p_amount is null or p_amount < 1 or p_amount > 1000000 then
        raise exception 'Coin amount must be between 1 and 1,000,000';
    end if;

    select l.user_id, l.points
      into v_target, v_board_points
    from public.leaderboard as l
    where l.username = v_username
    for update;

    if v_target is null then
        raise exception 'Account username not found';
    end if;

    -- Only the permanent owner may add coins to their own account.
    if v_target = v_actor and v_actor_role is distinct from 'owner' then
        raise exception 'Only the owner can add coins to their own account';
    end if;

    -- The leaderboard balance and the cloud-save balance change in one transaction so a
    -- successful grant cannot update only one of them.
    select s.save_data ->> 'balance'
      into v_raw_balance
    from public.player_saves as s
    where s.user_id = v_target
    for update;
    v_has_save := found;

    if not v_has_save then
        v_current_balance := 500;
        v_new_balance := 500 + p_amount;
        insert into public.player_saves (user_id, save_data)
        values (v_target, jsonb_build_object('balance', v_new_balance));
    else
        -- A player controls their own save text, so never trust it to be a clean number.
        -- If it is not one, fall back to the leaderboard balance.
        if v_raw_balance ~ '^[0-9]{1,10}$' and v_raw_balance::bigint <= 1000000000 then
            v_current_balance := v_raw_balance::bigint;
        else
            v_current_balance := least(greatest(v_board_points, 0), 1000000000);
        end if;
        if v_current_balance + p_amount > 1000000000 then
            raise exception 'This grant would exceed the maximum balance';
        end if;
        v_new_balance := v_current_balance + p_amount;
        update public.player_saves
        set save_data = jsonb_set(save_data, '{balance}', to_jsonb(v_new_balance), true)
        where user_id = v_target;
    end if;

    update public.leaderboard
    set points = v_new_balance,
        score_checked_at = now()
    where user_id = v_target;

    insert into public.mini_arcade_admin_audit
        (actor_user_id, action, target_user_id, target_username, details)
    values (
        v_actor,
        'spawn_coins',
        v_target,
        v_username,
        jsonb_build_object('amount', p_amount, 'new_balance', v_new_balance)
    );

    return v_new_balance;
end;
$$;

revoke all on function public.mini_arcade_admin_spawn_coins(text, bigint) from public, anon;
grant execute on function public.mini_arcade_admin_spawn_coins(text, bigint) to authenticated;
