-- Minimal Supabase-like environment for testing the migrations and RLS on plain PostgreSQL (≥ 15).
-- Do NOT run this on a Supabase project: Supabase already provides the auth schema and these roles.
--
--   createdb edufin_test
--   psql -d edufin_test -f supabase/tests/local_auth_stub.sql
--   psql -d edufin_test -f supabase/migrations/20260927000000_init.sql
--   psql -d edufin_test -f supabase/migrations/20260927000100_rls.sql
--   psql -d edufin_test -f supabase/seed.sql
--   psql -d edufin_test -f supabase/tests/rls_test.sql      # ends with "ALL RLS TESTS PASSED"
create schema if not exists auth;
create table auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
