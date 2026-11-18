-- Mini Arcade Hub v10: private player saves + authenticated shared leaderboard.
-- Run this full script in Supabase Dashboard -> SQL Editor.

-- ---------------------------------------------------------------------------
-- Private cloud saves: each account can access only its own JSON save.
-- ---------------------------------------------------------------------------
create table if not exists public.player_saves (
    user_id uuid primary key references auth.users (id) on delete cascade,
    save_data jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    constraint player_saves_data_must_be_object
        check (jsonb_typeof(save_data) = 'object')
);

alter table public.player_saves enable row level security;
revoke all on table public.player_saves from anon, authenticated;
grant select, insert, update on table public.player_saves to authenticated;

drop policy if exists "Players can read their own save" on public.player_saves;
create policy "Players can read their own save"
    on public.player_saves for select to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "Players can create their own save" on public.player_saves;
create policy "Players can create their own save"
    on public.player_saves for insert to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "Players can update their own save" on public.player_saves;
create policy "Players can update their own save"
    on public.player_saves for update to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create or replace function public.mini_arcade_touch_save_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists mini_arcade_player_saves_updated_at on public.player_saves;
create trigger mini_arcade_player_saves_updated_at
    before update on public.player_saves
    for each row execute function public.mini_arcade_touch_save_updated_at();

-- ---------------------------------------------------------------------------
-- Shared leaderboard: players can read all rows after sign-in, but may only
-- update their own nickname. The account username is server-created
-- from the internal Auth identity and is not writable through the client API.
-- ---------------------------------------------------------------------------
create table if not exists public.leaderboard (
    user_id uuid primary key references auth.users (id) on delete cascade,
    username text not null unique
        check (username ~ '^[a-z0-9_]{3,20}$'),
    nickname text not null default 'Player'
        check (char_length(nickname) between 1 and 18),
    points bigint not null default 500
        check (points between 0 and 1000000000),
    total_wins bigint not null default 0
        check (total_wins between 0 and 1000000000),
    blackjack_wins bigint not null default 0
        check (blackjack_wins between 0 and 1000000000),
    mini_game_wins bigint not null default 0
        check (mini_game_wins between 0 and 1000000000),
    trivia_correct bigint not null default 0
        check (trivia_correct between 0 and 1000000000),
    updated_at timestamptz not null default now()
);

alter table public.leaderboard enable row level security;
revoke all on table public.leaderboard from anon, authenticated;
grant select on table public.leaderboard to authenticated;
-- Players may edit only their display nickname. Score columns are written by the server
-- (see supabase_blackjack_leaderboard_setup.sql and supabase_security_hardening_v2.sql).
grant update (nickname)
    on table public.leaderboard to authenticated;

drop policy if exists "Signed-in players can read leaderboard" on public.leaderboard;
create policy "Signed-in players can read leaderboard"
    on public.leaderboard for select to authenticated
    using ((select auth.uid()) is not null);

drop policy if exists "Players can update their own leaderboard row" on public.leaderboard;
create policy "Players can update their own leaderboard row"
    on public.leaderboard for update to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

-- Create one immutable username row automatically when a username-mapped Auth
-- account is created. The game maps usernames to @accounts.miniarcade.invalid.
create or replace function public.mini_arcade_create_leaderboard_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    normalized_username text;
begin
    if new.email is null
       or split_part(new.email, '@', 2) <> 'accounts.miniarcade.invalid' then
        return new;
    end if;

    normalized_username := lower(split_part(new.email, '@', 1));
    insert into public.leaderboard (user_id, username, nickname)
    values (new.id, normalized_username, normalized_username)
    on conflict (user_id) do nothing;
    return new;
end;
$$;

revoke all on function public.mini_arcade_create_leaderboard_row() from public, anon, authenticated;
drop trigger if exists mini_arcade_auth_user_leaderboard on auth.users;
create trigger mini_arcade_auth_user_leaderboard
    after insert on auth.users
    for each row execute function public.mini_arcade_create_leaderboard_row();

-- Backfill existing accounts from v9 so current players appear too.
insert into public.leaderboard (user_id, username, nickname)
select id, lower(split_part(email, '@', 1)), lower(split_part(email, '@', 1))
from auth.users
where split_part(coalesce(email, ''), '@', 2) = 'accounts.miniarcade.invalid'
on conflict (user_id) do nothing;

create or replace function public.mini_arcade_touch_leaderboard_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists mini_arcade_leaderboard_updated_at on public.leaderboard;
create trigger mini_arcade_leaderboard_updated_at
    before update on public.leaderboard
    for each row execute function public.mini_arcade_touch_leaderboard_updated_at();
