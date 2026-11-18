-- Sync the signed-in player's saved Blackjack wins and point balance to their own leaderboard row.
-- Run AFTER supabase_setup.sql. The browser cannot choose a target user or score values.
-- This reads only the authenticated user's private player_saves row.

create or replace function public.mini_arcade_sync_blackjack_wins()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := (select auth.uid());
    v_raw_wins text;
    v_raw_points text;
    v_wins bigint;
begin
    if v_user_id is null then
        raise exception 'Sign-in required';
    end if;

    select s.save_data ->> 'blackjack_wins',
           s.save_data ->> 'balance'
      into v_raw_wins, v_raw_points
    from public.player_saves s
    where s.user_id = v_user_id;

    if v_raw_wins is null or v_raw_wins !~ '^[0-9]{1,10}$' then
        v_wins := 0;
    else
        v_wins := least(v_raw_wins::bigint, 1000000000);
    end if;

    update public.leaderboard
       set blackjack_wins = v_wins,
           points = case
               when v_raw_points ~ '^[0-9]{1,10}$'
                    and v_raw_points::bigint <= 1000000000
               then v_raw_points::bigint
               else points
           end
     where user_id = v_user_id;

    if not found then
        raise exception 'Leaderboard account not found';
    end if;

    return v_wins;
end;
$$;

revoke all on function public.mini_arcade_sync_blackjack_wins() from public, anon;
grant execute on function public.mini_arcade_sync_blackjack_wins() to authenticated;
