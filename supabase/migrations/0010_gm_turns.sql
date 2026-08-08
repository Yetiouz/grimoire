-- ── 0010: gm_turns ───────────────────────────────────────────────────
-- Telemetry for the AI GM. Deliberately NOT campaign_events: that table is
-- the story ledger and stays fiction-only. This one records what each GM
-- turn cost, what it invented, and the raw transcript so prompt tuning can
-- be replayed locally without spending provider quota.

create table gm_turns (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references campaigns(id) on delete cascade,
  session_id     uuid references sessions(id),
  user_id        uuid not null references auth.users(id),
  created_at     timestamptz not null default now(),
  status         text not null check (status in
                   ('ok','capped','looped','timeout','budget_exhausted','disabled','error')),
  request_count  int not null default 0,
  input_tokens   int,
  output_tokens  int,
  transcript     jsonb,
  inventions     jsonb,
  error          text
);

create index gm_turns_campaign_created_idx on gm_turns (campaign_id, created_at desc);
create index gm_turns_user_created_idx     on gm_turns (user_id, created_at desc);

alter table gm_turns enable row level security;

-- select-only, member-scoped, matching every other table in this schema.
-- No insert/update/delete policy on any role: writes go through the
-- security-definer function below, which does its own membership check.
create policy gm_turns_select_member
  on gm_turns for select
  using (exists (
    select 1 from campaign_members
    where campaign_members.campaign_id = gm_turns.campaign_id
      and campaign_members.user_id = auth.uid()
  ));


-- ── budget: how many provider requests has this user spent since X ──
create or replace function gm_requests_since(p_since timestamptz)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_total int;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select coalesce(sum(request_count), 0)
    into v_total
    from gm_turns
   where user_id = v_user
     and created_at >= p_since;

  return v_total;
end;
$$;


-- ── record one completed (or aborted) turn ──────────────────────────
create or replace function gm_record_turn(
  p_campaign_id   uuid,
  p_session_id    uuid,
  p_status        text,
  p_request_count int,
  p_input_tokens  int    default null,
  p_output_tokens int    default null,
  p_transcript    jsonb  default null,
  p_inventions    jsonb  default null,
  p_error         text   default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id   uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from campaign_members
     where campaign_id = p_campaign_id
       and user_id = v_user
  ) then
    raise exception 'not a member of this campaign';
  end if;

  insert into gm_turns (
    campaign_id, session_id, user_id, status, request_count,
    input_tokens, output_tokens, transcript, inventions, error
  ) values (
    p_campaign_id, p_session_id, v_user, p_status, p_request_count,
    p_input_tokens, p_output_tokens, p_transcript, p_inventions, p_error
  )
  returning id into v_id;

  return v_id;
end;
$$;


-- ── anonymous execute revoked explicitly, as everywhere else ────────
revoke all on function gm_requests_since(timestamptz) from public, anon;
revoke all on function gm_record_turn(uuid, uuid, text, int, int, int, jsonb, jsonb, text) from public, anon;

grant execute on function gm_requests_since(timestamptz) to authenticated;
grant execute on function gm_record_turn(uuid, uuid, text, int, int, int, jsonb, jsonb, text) to authenticated;
