-- Admin-only fictional coin generator for the web version.
-- Run AFTER supabase_setup.sql and supabase_admin_setup.sql.

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
    v_target uuid;
    v_username text := lower(trim(coalesce(p_username, '')));
    v_current_balance bigint;
    v_new_balance bigint;
    v_save jsonb;
begin
    if v_actor is null then
        raise exception 'Sign-in required';
    end if;
    if coalesce(public.mini_arcade_admin_check(), '') not in ('owner', 'admin') then
        raise exception 'Administrator permission required';
    end if;
    if v_username !~ '^[a-z0-9_]{3,20}$' then
        raise exception 'Invalid username';
    end if;
    if p_amount is null or p_amount < 1 or p_amount > 1000000 then
        raise exception 'Coin amount must be between 1 and 1,000,000';
    end if;

    select l.user_id, l.points
      into v_target, v_current_balance
    from public.leaderboard l
    where l.username = v_username
    for update;

    if v_target is null then
        raise exception 'Account username not found';
    end if;

    -- The leaderboard balance and the cloud-save balance are changed in one
    -- transaction so a successful grant cannot update only one representation.
    select coalesce((s.save_data ->> 'balance')::bigint, 500)
      into v_current_balance
    from public.player_saves s
    where s.user_id = v_target
    for update;

    if not found then
        v_current_balance := 500;
        insert into public.player_saves(user_id, save_data)
        values (v_target, jsonb_build_object('balance', 500 + p_amount));
    else
        if v_current_balance < 0 or v_current_balance > 1000000000 then
            raise exception 'Target balance is outside the supported range';
        end if;
        if v_current_balance + p_amount > 1000000000 then
            raise exception 'This grant would exceed the maximum balance';
        end if;
        update public.player_saves
        set save_data = jsonb_set(save_data, '{balance}', to_jsonb(v_current_balance + p_amount), true)
        where user_id = v_target;
    end if;

    if not exists (select 1 from public.player_saves s where s.user_id = v_target) then
        raise exception 'Could not update player save';
    end if;

    select (s.save_data ->> 'balance')::bigint
      into v_new_balance
    from public.player_saves s
    where s.user_id = v_target;

    update public.leaderboard
    set points = v_new_balance
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
