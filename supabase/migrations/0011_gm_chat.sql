-- ── 0011: the rules chat ─────────────────────────────────────────────
-- Out-of-character questions kept deliberately apart from the campaign.
-- NOT journal_entries (that is fiction) and NOT campaign_events (that is
-- the authoritative ledger of what happened). A rules question is neither:
-- it is table talk, and it belongs in its own room.

create table gm_chat (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id     uuid not null references auth.users(id),
  role        text not null check (role in ('user', 'assistant')),
  body        text not null,
  created_at  timestamptz not null default now()
);

create index gm_chat_campaign_created_idx on gm_chat (campaign_id, created_at);

alter table gm_chat enable row level security;

-- Select-only and member-scoped, matching every other table. Writes go
-- through the security-definer command below.
create policy gm_chat_select_member
  on gm_chat for select
  using (exists (
    select 1 from campaign_members
    where campaign_members.campaign_id = gm_chat.campaign_id
      and campaign_members.user_id = auth.uid()
  ));


-- Separates rules questions from play in the telemetry, so "how many
-- requests did I actually spend on the game" stays answerable.
alter table gm_turns add column mode text not null default 'play';
alter table gm_turns add constraint gm_turns_mode_check check (mode in ('play', 'rules'));


-- ── record one chat message ─────────────────────────────────────────
create or replace function gm_record_chat(
  p_campaign_id uuid,
  p_role        text,
  p_body        text
)
returns gm_chat
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row  gm_chat;
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

  insert into gm_chat (campaign_id, user_id, role, body)
  values (p_campaign_id, v_user, p_role, p_body)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function gm_record_chat(uuid, text, text) from public, anon;
grant execute on function gm_record_chat(uuid, text, text) to authenticated;
