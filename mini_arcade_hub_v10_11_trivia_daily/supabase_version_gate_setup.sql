-- Mini Arcade Hub v10.10: server-controlled MINIMUM GAME VERSION. Safe to run more than once.
-- Run in Supabase -> SQL Editor, after the other supabase_*.sql scripts.
--
-- How it works
--   * Every copy of the game (website, Windows app, Android app) sends its version in a request
--     header called x-mini-arcade-version.
--   * Supabase runs mini_arcade_enforce_client_version() before EVERY data request (tables and
--     functions). If a minimum version is set and the request is older, missing a version, or
--     has an invalid version, the request is refused with HTTP 426 "update_required".
--   * Versions before v10.10 never send the header, so as soon as a minimum is set they can no
--     longer load or save online data, read the leaderboard, or use admin functions.
--   * The minimum lives in one row of mini_arcade_app_config. Change it any time with one
--     UPDATE statement; no rebuild is needed. It starts EMPTY, which means "everyone allowed",
--     so running this script alone locks nobody out.
--
-- Honest limits
--   * The version is reported by the player's own computer, so someone who edits their copy can
--     claim to be new. This stops honest old copies, not a determined cheater.
--   * Signing in and creating accounts use Supabase's separate Auth service, which this cannot
--     gate. Old copies can still sign in; they just cannot load or save anything.
--   * Players on versions before v10.10 get a generic "could not load" style error from their
--     old copy, not a friendly update message, because the old code does not know about this.

-- ---------------------------------------------------------------------------
-- 1. The setting (one row, no access for players)
-- ---------------------------------------------------------------------------
create table if not exists public.mini_arcade_app_config (
    id smallint primary key default 1 check (id = 1),
    min_client_version text
        check (min_client_version is null or min_client_version ~ '^[0-9]{1,4}(\.[0-9]{1,4}){0,2}$'),
    update_message text not null default '' check (char_length(update_message) <= 300),
    updated_at timestamptz not null default now()
);

alter table public.mini_arcade_app_config enable row level security;
revoke all on table public.mini_arcade_app_config from public, anon, authenticated;
insert into public.mini_arcade_app_config (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Version comparison helper ("10.10" > "10.9"; compared number by number)
-- ---------------------------------------------------------------------------
create or replace function public.mini_arcade_version_parts(p_version text)
returns int[]
language sql
immutable
set search_path = ''
as $$
    select case
        when p_version ~ '^[0-9]{1,4}(\.[0-9]{1,4}){0,2}$'
        then (string_to_array(p_version, '.')::int[] || array[0, 0, 0])[1:3]
    end;
$$;

revoke all on function public.mini_arcade_version_parts(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Lets a game tell the player WHY it is blocked (allowed even for old versions)
-- ---------------------------------------------------------------------------
create or replace function public.mini_arcade_client_requirements()
returns table (min_client_version text, update_message text)
language sql
stable
security definer
set search_path = ''
as $$
    select c.min_client_version, c.update_message
    from public.mini_arcade_app_config as c
    where c.id = 1;
$$;

revoke all on function public.mini_arcade_client_requirements() from public;
grant execute on function public.mini_arcade_client_requirements() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. The gate itself, run by Supabase before every API request
-- ---------------------------------------------------------------------------
create or replace function public.mini_arcade_enforce_client_version()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_min text;
    v_message text;
    v_header text;
    v_path text := coalesce(current_setting('request.path', true), '');
    v_role text := '';
    v_have int[];
    v_need int[];
begin
    select c.min_client_version, c.update_message
      into v_min, v_message
    from public.mini_arcade_app_config as c
    where c.id = 1;

    -- No minimum set: everyone is allowed.
    if v_min is null or v_min = '' then
        return;
    end if;

    -- Server-side tools that use the secret key are never blocked.
    begin
        v_role := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role', '');
    exception when others then
        v_role := '';
    end;
    if v_role = 'service_role' then
        return;
    end if;

    -- The one call an old game may always make, so a new game can show a friendly message.
    -- Exact paths only (Supabase's API sees the first form; the second is the public URL form).
    if v_path in ('/rpc/mini_arcade_client_requirements', '/rest/v1/rpc/mini_arcade_client_requirements') then
        return;
    end if;

    begin
        v_header := nullif(current_setting('request.headers', true), '')::json ->> 'x-mini-arcade-version';
    exception when others then
        v_header := null;
    end;

    v_have := public.mini_arcade_version_parts(v_header);
    v_need := public.mini_arcade_version_parts(v_min);

    if v_need is not null and (v_have is null or v_have < v_need) then
        raise sqlstate 'PGRST' using
            message = json_build_object(
                'code', 'update_required',
                'message', coalesce(
                    nullif(v_message, ''),
                    'This version of Mini Arcade is too old for online play. Please update to version '
                        || v_min || ' or newer.'
                ),
                'details', 'minimum_version=' || v_min || '; your_version=' || coalesce(left(v_header, 20), 'unknown'),
                'hint', null
            )::text,
            detail = '{"status":426,"headers":{}}';
    end if;
end;
$$;

revoke all on function public.mini_arcade_enforce_client_version() from public;
grant execute on function public.mini_arcade_enforce_client_version()
    to anon, authenticated, service_role, authenticator;

-- ---------------------------------------------------------------------------
-- 5. Tell Supabase's API (PostgREST) to run the gate before every request
-- ---------------------------------------------------------------------------
-- If your project already uses a different pre-request function, stop instead of replacing it.
do $$
declare
    v_existing text;
begin
    select cfg into v_existing
    from pg_roles as r, unnest(r.rolconfig) as cfg
    where r.rolname = 'authenticator' and cfg like 'pgrst.db_pre_request=%';

    if v_existing is not null
       and v_existing <> 'pgrst.db_pre_request=public.mini_arcade_enforce_client_version' then
        raise exception 'Another pre-request function is already configured (%). Ask for help before replacing it.', v_existing;
    end if;
end
$$;

alter role authenticator set pgrst.db_pre_request = 'public.mini_arcade_enforce_client_version';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- HOW TO USE IT (run these one at a time, only when you want them)
-- ---------------------------------------------------------------------------
-- Require version 10.10 or newer (older copies are blocked immediately):
--   update public.mini_arcade_app_config
--      set min_client_version = '10.10',
--          update_message = 'Please download the newest Mini Arcade Hub to keep playing online.',
--          updated_at = now()
--    where id = 1;
--
-- Turn the gate OFF again (instant rollback if anything looks wrong):
--   update public.mini_arcade_app_config
--      set min_client_version = null, updated_at = now() where id = 1;
--
-- See the current setting:
--   select min_client_version, update_message from public.mini_arcade_app_config;
--
-- Remove the gate completely (only if you no longer want it):
--   alter role authenticator reset pgrst.db_pre_request;
--   notify pgrst, 'reload config';
