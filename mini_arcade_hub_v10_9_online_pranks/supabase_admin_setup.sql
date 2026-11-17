-- Mini Arcade Hub v10: server-controlled administrator roles.
-- Run this AFTER supabase_setup.sql in Supabase SQL Editor.
-- The permanent owner is pinned to the Auth UUID supplied by the project owner.

create table if not exists public.mini_arcade_admin_roles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    role text not null check (role in ('owner', 'admin')),
    granted_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    constraint mini_arcade_only_one_owner check (role in ('owner', 'admin'))
);

create table if not exists public.mini_arcade_admin_audit (
    id bigint generated always as identity primary key,
    actor_user_id uuid references auth.users(id) on delete set null,
    action text not null,
    target_user_id uuid references auth.users(id) on delete set null,
    target_username text,
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create unique index if not exists mini_arcade_single_owner
    on public.mini_arcade_admin_roles (role)
    where role = 'owner';

alter table public.mini_arcade_admin_roles enable row level security;
alter table public.mini_arcade_admin_audit enable row level security;
revoke all on table public.mini_arcade_admin_roles from anon, authenticated;
revoke all on table public.mini_arcade_admin_audit from anon, authenticated;

-- Bootstrap the permanent owner. This fails safely if the UUID is not an existing Auth user.
do $$
begin
    if not exists (
        select 1 from auth.users
        where id = 'a08c39e5-036e-4c4b-bb77-f291da35de07'::uuid
    ) then
        raise exception 'Owner Auth user was not found. Sign in/create mynameiskarl first, then rerun this script.';
    end if;

    if not exists (
        select 1 from public.leaderboard
        where user_id = 'a08c39e5-036e-4c4b-bb77-f291da35de07'::uuid
          and username = 'mynameiskarl'
    ) then
        raise exception 'The supplied Auth UUID does not match the mynameiskarl leaderboard account. Stop and verify the account before continuing.';
    end if;

    insert into public.mini_arcade_admin_roles (user_id, role, granted_by)
    values (
        'a08c39e5-036e-4c4b-bb77-f291da35de07'::uuid,
        'owner',
        'a08c39e5-036e-4c4b-bb77-f291da35de07'::uuid
    )
    on conflict (user_id) do update
       set role = 'owner', granted_by = excluded.granted_by;
end;
$$;

create or replace function public.mini_arcade_admin_check()
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select r.role
    from public.mini_arcade_admin_roles as r
    where r.user_id = (select auth.uid())
    limit 1;
$$;

create or replace function public.mini_arcade_admin_list_roles()
returns table (username text, role text, created_at timestamptz)
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
    select l.username, r.role, r.created_at
    from public.mini_arcade_admin_roles as r
    join public.leaderboard as l on l.user_id = r.user_id
    order by case when r.role = 'owner' then 0 else 1 end, l.username;
end;
$$;

create or replace function public.mini_arcade_admin_set_role(p_username text, p_role text)
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
        raise exception 'Only the permanent owner can manage administrators';
    end if;

    if clean_username !~ '^[a-z0-9_]{3,20}$' then
        raise exception 'Invalid username';
    end if;

    if p_role is null or p_role not in ('admin', 'none') then
        raise exception 'Role must be admin or none';
    end if;

    select l.user_id into target_id
    from public.leaderboard as l
    where l.username = clean_username;

    if target_id is null then
        raise exception 'Account username not found';
    end if;

    if target_id = 'a08c39e5-036e-4c4b-bb77-f291da35de07'::uuid then
        raise exception 'The permanent owner cannot be changed';
    end if;

    if p_role = 'admin' then
        insert into public.mini_arcade_admin_roles (user_id, role, granted_by)
        values (target_id, 'admin', actor_id)
        on conflict (user_id) do update
            set role = 'admin', granted_by = excluded.granted_by;
        insert into public.mini_arcade_admin_audit
            (actor_user_id, action, target_user_id, target_username, details)
        values (actor_id, 'grant_admin', target_id, clean_username, '{"role":"admin"}'::jsonb);
    else
        delete from public.mini_arcade_admin_roles
        where user_id = target_id and role = 'admin';
        insert into public.mini_arcade_admin_audit
            (actor_user_id, action, target_user_id, target_username, details)
        values (actor_id, 'revoke_admin', target_id, clean_username, '{"role":"none"}'::jsonb);
    end if;
end;
$$;

create or replace function public.mini_arcade_admin_audit_list()
returns table (action text, target_username text, created_at timestamptz)
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
    select a.action, a.target_username, a.created_at
    from public.mini_arcade_admin_audit as a
    order by a.created_at desc
    limit 50;
end;
$$;

-- No client-side direct writes to role/audit tables. All changes go through the
-- SECURITY DEFINER RPC above, which verifies the caller's server-side role.
revoke all on function public.mini_arcade_admin_check() from public, anon;
revoke all on function public.mini_arcade_admin_list_roles() from public, anon;
revoke all on function public.mini_arcade_admin_set_role(text, text) from public, anon;
revoke all on function public.mini_arcade_admin_audit_list() from public, anon;
grant execute on function public.mini_arcade_admin_check() to authenticated;
grant execute on function public.mini_arcade_admin_list_roles() to authenticated;
grant execute on function public.mini_arcade_admin_set_role(text, text) to authenticated;
grant execute on function public.mini_arcade_admin_audit_list() to authenticated;

-- Explicitly keep table access unavailable to browser/desktop client roles.
revoke all on public.mini_arcade_admin_roles from anon, authenticated;
revoke all on public.mini_arcade_admin_audit from anon, authenticated;
