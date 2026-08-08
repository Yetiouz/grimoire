-- auth-shim.sql — test-only stand-in for Supabase's real `auth` schema.
--
-- This file is NEVER applied to the real project (Supabase already has the
-- genuine GoTrue-backed `auth` schema there — running this against it would
-- be a conflict, not a fix). It exists only inside the disposable Postgres
-- database these tests spin up.
--
-- The command layer's entire auth surface is `auth.uid()` plus a foreign
-- key to `auth.users(id)`. Real Supabase resolves `auth.uid()` from the
-- caller's JWT via a `request.jwt.claims` GUC set by PostgREST per request.
-- This shim reproduces exactly that contract — a per-session setting that
-- `auth.uid()` reads — without needing PostgREST, GoTrue, or a real JWT.
-- Tests impersonate a user by calling test_set_user() before each command.

create extension if not exists pgcrypto;

create schema if not exists auth;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- Test-only helper — not part of any real schema, never referenced by the
-- application. `local = false` so it survives across statements in the same
-- session/connection, matching how a real request's claim stays set for
-- the life of that request.
create or replace function test_set_user(p_user uuid) returns void
language sql
as $$
  select set_config('request.jwt.claim.sub', p_user::text, false);
$$;

-- The three roles every migration's GRANT/REVOKE statements reference.
-- Supabase creates these once per project; a from-scratch Postgres has
-- none of them.
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end
$$;
