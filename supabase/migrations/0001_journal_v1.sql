-- 0001_journal_v1.sql
-- Journal v1 slice: campaigns, membership, sessions, journal entries, and
-- the append-only campaign event ledger. Three multi-system seams land
-- here (BUILD_PLAN.md): campaigns.system, campaign_members existing from
-- day one with just the owner row, and journal_entries/campaign_events
-- kept schema-agnostic (free-text kind, jsonb payload) rather than
-- hardcoded per-system columns.
--
-- Write path: exclusively through the four SECURITY DEFINER functions at
-- the bottom of this file (create_campaign, start_session,
-- log_journal_entry, amend_journal_entry). No table below has an
-- INSERT/UPDATE/DELETE policy — every mutation goes through a command
-- that stamps auth.uid() as actor and writes an event to campaign_events
-- in the same transaction. campaign_events has no UPDATE/DELETE policy
-- at all, on any role: true append-only by construction.

-- ── campaigns ────────────────────────────────────────────────────────
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id),
  name text not null,
  system text not null default 'shadowdark',
  created_at timestamptz not null default now()
);

-- ── campaign_members ─────────────────────────────────────────────────
-- Exists from day one with just the owner row (M2 seam: invites add rows
-- later, no schema change). role is unused in v1 (always 'owner') but
-- present so M2's GM/player distinction doesn't need a migration.
create table campaign_members (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  role text not null default 'owner',
  joined_at timestamptz not null default now(),
  unique (campaign_id, user_id)
);

-- ── sessions ─────────────────────────────────────────────────────────
-- ended_at IS NULL means "open" — entries attach to whichever session is
-- open. The partial unique index below guarantees at most one open
-- session per campaign; start_session() enforces the auto-close
-- (amendment: starting the next session is how one ends, no separate
-- "end session" UI in v1).
create table sessions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  number int not null,
  title text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (campaign_id, number)
);

create unique index sessions_one_open_per_campaign
  on sessions (campaign_id)
  where ended_at is null;

-- ── journal_entries ──────────────────────────────────────────────────
-- actor_name/actor_color are always supplied by the caller (the app
-- decides "GM"/muted-color for narration and system entries — the
-- component layer never invents its own defaults, per SPEC's
-- shared-components rule) so both are required, not nullable, except
-- actor_color which stays optional (system/narration entries can omit
-- it and fall back to a muted color at render time, same mechanism the
-- approved mockup uses).
create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  author uuid not null references auth.users(id),
  kind text not null check (kind in ('narration', 'action', 'roll', 'note', 'system')),
  body text not null,
  actor_name text not null,
  actor_color text,
  created_at timestamptz not null default now()
);

create index journal_entries_campaign_created_idx
  on journal_entries (campaign_id, created_at);

-- ── campaign_events (append-only ledger) ────────────────────────────
create table campaign_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  actor uuid not null references auth.users(id),
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index campaign_events_campaign_created_idx
  on campaign_events (campaign_id, created_at);

-- ── RLS ──────────────────────────────────────────────────────────────
alter table campaigns enable row level security;
alter table campaign_members enable row level security;
alter table sessions enable row level security;
alter table journal_entries enable row level security;
alter table campaign_events enable row level security;

-- campaign_members: you can only see your own membership row. Enough for
-- v1 (owner-only); M2 can add a "see other members of my campaigns"
-- policy without touching this one or any v1 data.
create policy campaign_members_select_own
  on campaign_members for select
  using (user_id = auth.uid());

-- campaigns / sessions / journal_entries / campaign_events: readable by
-- members of that campaign. No insert/update/delete policies anywhere in
-- this migration, on any table — the four functions below are the only
-- write path, by construction (RLS denies any command with no matching
-- policy, so this isn't convention, it's enforced).
create policy campaigns_select_member
  on campaigns for select
  using (exists (
    select 1 from campaign_members
    where campaign_members.campaign_id = campaigns.id
      and campaign_members.user_id = auth.uid()
  ));

create policy sessions_select_member
  on sessions for select
  using (exists (
    select 1 from campaign_members
    where campaign_members.campaign_id = sessions.campaign_id
      and campaign_members.user_id = auth.uid()
  ));

create policy journal_entries_select_member
  on journal_entries for select
  using (exists (
    select 1 from campaign_members
    where campaign_members.campaign_id = journal_entries.campaign_id
      and campaign_members.user_id = auth.uid()
  ));

create policy campaign_events_select_member
  on campaign_events for select
  using (exists (
    select 1 from campaign_members
    where campaign_members.campaign_id = campaign_events.campaign_id
      and campaign_members.user_id = auth.uid()
  ));

-- ── Commands ─────────────────────────────────────────────────────────
-- All four are SECURITY DEFINER (so one call can write across several
-- tables atomically regardless of the caller's own row-level access) with
-- search_path pinned to `public, pg_temp` — never left to inherit the
-- caller's search_path — which is exactly what closes the search-path-
-- hijack hole Supabase's advisor checks for on SECURITY DEFINER
-- functions. Every function also checks auth.uid() itself rather than
-- trusting RLS to gate it, because RLS on these tables has no
-- INSERT/UPDATE policy at all — these functions ARE the entire write
-- surface, and they behave accordingly rather than assuming a policy
-- has their back.

create or replace function create_campaign(p_name text)
returns campaigns
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_campaign campaigns;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  insert into campaigns (owner, name)
  values (v_uid, p_name)
  returning * into v_campaign;

  insert into campaign_members (campaign_id, user_id, role)
  values (v_campaign.id, v_uid, 'owner');

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (v_campaign.id, v_uid, 'campaign_created', jsonb_build_object('name', p_name));

  return v_campaign;
end;
$$;

create or replace function start_session(p_campaign_id uuid, p_title text default null)
returns sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_open sessions;
  v_next_number int;
  v_session sessions;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from campaign_members
    where campaign_id = p_campaign_id and user_id = v_uid
  ) then
    raise exception 'not a member of this campaign';
  end if;

  -- Auto-close any currently-open session first (amendment: starting the
  -- next session is how one ends). Locked with FOR UPDATE so two
  -- concurrent start_session calls can't both see the same open session.
  select * into v_open from sessions
  where campaign_id = p_campaign_id and ended_at is null
  for update;

  if found then
    update sessions set ended_at = now() where id = v_open.id;
    insert into campaign_events (campaign_id, actor, kind, payload)
    values (
      p_campaign_id, v_uid, 'session_ended',
      jsonb_build_object('session_id', v_open.id, 'number', v_open.number)
    );
  end if;

  select coalesce(max(number), 0) + 1 into v_next_number
  from sessions where campaign_id = p_campaign_id;

  insert into sessions (campaign_id, number, title)
  values (p_campaign_id, v_next_number, p_title)
  returning * into v_session;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (
    p_campaign_id, v_uid, 'session_started',
    jsonb_build_object('session_id', v_session.id, 'number', v_session.number)
  );

  return v_session;
end;
$$;

create or replace function log_journal_entry(
  p_campaign_id uuid,
  p_session_id uuid,
  p_kind text,
  p_body text,
  p_actor_name text,
  p_actor_color text default null
)
returns journal_entries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_entry journal_entries;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from campaign_members
    where campaign_id = p_campaign_id and user_id = v_uid
  ) then
    raise exception 'not a member of this campaign';
  end if;

  if not exists (
    select 1 from sessions
    where id = p_session_id and campaign_id = p_campaign_id
  ) then
    raise exception 'session does not belong to this campaign';
  end if;

  insert into journal_entries (campaign_id, session_id, author, kind, body, actor_name, actor_color)
  values (p_campaign_id, p_session_id, v_uid, p_kind, p_body, p_actor_name, p_actor_color)
  returning * into v_entry;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (
    p_campaign_id, v_uid, 'journal_entry_logged',
    jsonb_build_object('entry_id', v_entry.id, 'kind', p_kind)
  );

  return v_entry;
end;
$$;

-- Amendment 1: body-only edits by the original author. The prior body
-- travels into the ledger event's payload, so history stays permanent
-- even though the row itself changes — no delete anywhere, and this is
-- the only function that performs an UPDATE rather than an INSERT.
create or replace function amend_journal_entry(p_entry_id uuid, p_new_body text)
returns journal_entries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_prior journal_entries;
  v_entry journal_entries;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_prior from journal_entries where id = p_entry_id;

  if not found then
    raise exception 'entry not found';
  end if;

  if v_prior.author <> v_uid then
    raise exception 'only the original author can amend this entry';
  end if;

  update journal_entries
  set body = p_new_body
  where id = p_entry_id
  returning * into v_entry;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (
    v_entry.campaign_id, v_uid, 'journal_entry_amended',
    jsonb_build_object('entry_id', v_entry.id, 'prior_body', v_prior.body, 'new_body', p_new_body)
  );

  return v_entry;
end;
$$;

-- RLS on these tables has no INSERT/UPDATE policy, so these functions
-- are the only write path — grant execute to authenticated users only;
-- anon gets nothing (matches "GitHub OAuth only in v1").
grant execute on function create_campaign(text) to authenticated;
grant execute on function start_session(uuid, text) to authenticated;
grant execute on function log_journal_entry(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function amend_journal_entry(uuid, text) to authenticated;
