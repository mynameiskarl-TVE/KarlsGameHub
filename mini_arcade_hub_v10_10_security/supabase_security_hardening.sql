-- Mini Arcade Hub: database hardening. Safe to run more than once.
-- Run AFTER supabase_setup.sql and supabase_admin_setup.sql, in Supabase -> SQL Editor.

-- Cap the size of each cloud save. A normal save is only a couple of KB, but without a
-- limit any account could upload huge JSON files and fill your database storage.
-- NOT VALID means existing rows are not re-scanned; every new insert/update is checked.
alter table public.player_saves
    drop constraint if exists player_saves_data_size_limit;
alter table public.player_saves
    add constraint player_saves_data_size_limit
    check (octet_length(save_data::text) <= 65536) not valid;
