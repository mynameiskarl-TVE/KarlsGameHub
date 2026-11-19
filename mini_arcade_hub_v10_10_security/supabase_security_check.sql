-- Mini Arcade Hub: read-only security check. Changes nothing.
-- Run in Supabase -> SQL Editor. A healthy project returns ZERO rows.
-- Any row it returns names something that should be reviewed before sharing the game.

select 'public table without Row Level Security' as problem, c.relname::text as detail
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity

union all
select 'anonymous (signed-out) role has table access', c.relname::text
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate')

union all
select 'players can touch an admin table directly', t.name
from (values ('public.mini_arcade_admin_roles'), ('public.mini_arcade_admin_audit')) as t(name)
where has_table_privilege('authenticated', t.name::regclass, 'select,insert,update,delete,truncate')
   or has_table_privilege('anon', t.name::regclass, 'select,insert,update,delete,truncate')

union all
select 'signed-out role can call a Mini Arcade function', p.oid::regprocedure::text
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'mini_arcade%'
  and p.prorettype <> 'trigger'::regtype
  -- These two are meant to be callable while signed out: the version-gate lookup, and the gate
  -- itself (Supabase runs it as the signed-out role on every request).
  and p.proname not in ('mini_arcade_client_requirements', 'mini_arcade_enforce_client_version')
  and has_function_privilege('anon', p.oid, 'execute')

union all
select 'players can write a protected leaderboard column', a.attname::text
from pg_attribute a
where a.attrelid = 'public.leaderboard'::regclass and a.attnum > 0 and not a.attisdropped
  and a.attname in ('user_id', 'username', 'is_suspended', 'suspended_reason', 'suspended_at')
  and has_column_privilege('authenticated', a.attrelid, a.attnum, 'update')

union all
select 'players can write a score column directly', a.attname::text
from pg_attribute a
where a.attrelid = 'public.leaderboard'::regclass and a.attnum > 0 and not a.attisdropped
  and a.attname in ('points', 'total_wins', 'blackjack_wins', 'mini_game_wins', 'trivia_correct', 'score_checked_at')
  and has_column_privilege('authenticated', a.attrelid, a.attnum, 'update')

union all
select 'save write policy does not check suspension (run supabase_security_hardening_v2.sql)', p.policyname::text
from pg_policies p
where p.schemaname = 'public' and p.tablename = 'player_saves' and p.cmd in ('INSERT', 'UPDATE')
  and coalesce(p.with_check, '') not like '%mini_arcade_caller_is_suspended%'

union all
select 'players can reach the app version setting', 'mini_arcade_app_config'
where to_regclass('public.mini_arcade_app_config') is not null
  and (has_table_privilege('anon', 'public.mini_arcade_app_config', 'select,insert,update,delete')
       or has_table_privilege('authenticated', 'public.mini_arcade_app_config', 'select,insert,update,delete'))

union all
select 'more than one owner exists', count(*)::text
from public.mini_arcade_admin_roles
where role = 'owner'
having count(*) <> 1;
