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
select 'signed-out role can call an admin function', p.oid::regprocedure::text
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'mini_arcade_admin%'
  and has_function_privilege('anon', p.oid, 'execute')

union all
select 'players can write a protected leaderboard column', col.c
from (values ('user_id'), ('username')) as col(c)
where has_column_privilege('authenticated', 'public.leaderboard', col.c, 'update')

union all
select 'more than one owner exists', count(*)::text
from public.mini_arcade_admin_roles
where role = 'owner'
having count(*) <> 1;
