-- 0033_campaign_gm_mode_select.sql
-- Owner request, 2026-08-15 ("i want one when starting a campaign. and
-- a toggle.") -- campaigns.gm_mode (migration 0019) has never had any
-- way to set it from the app: create_campaign always took gm_mode's
-- table default ('solo'), and nothing could change it after creation
-- either (The Black Road's 'ai' value was set by hand in 0019's own
-- backfill, not through any UI). This closes both gaps: create_campaign
-- gains an optional p_gm_mode parameter (defaulting to 'solo', so the
-- existing one-arg call every build before this made keeps working
-- unchanged), and a new owner-only update_campaign_gm_mode RPC lets an
-- existing campaign's mode be changed later -- same owner-check shape
-- ensure_campaign_join_code (0023) already established.

-- Dropped rather than left alongside a new two-arg overload: a trailing
-- DEFAULT parameter makes create_campaign(text) and
-- create_campaign(text, text default ...) ambiguous to PostgreSQL's
-- overload resolution for a one-arg call, which would break the
-- existing call site (and this session's own 0034+ migrations) rather
-- than just add to it.
drop function if exists create_campaign(text);

create or replace function create_campaign(p_name text, p_gm_mode text default 'solo')
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

  insert into campaigns (owner, name, gm_mode)
  values (v_uid, p_name, p_gm_mode)
  returning * into v_campaign;

  insert into campaign_members (campaign_id, user_id, role)
  values (v_campaign.id, v_uid, 'owner');

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (v_campaign.id, v_uid, 'campaign_created', jsonb_build_object('name', p_name));

  return v_campaign;
end;
$$;

grant execute on function create_campaign(text, text) to authenticated;
revoke execute on function create_campaign(text, text) from public;
revoke execute on function create_campaign(text, text) from anon;

-- Owner-only, same shape as ensure_campaign_join_code (0023): confirm
-- the caller is this campaign's owner before touching it. No self-loop
-- guard needed -- setting a campaign to the mode it's already on is a
-- harmless no-op update plus one redundant event row, not worth a
-- special case.
create or replace function update_campaign_gm_mode(p_campaign_id uuid, p_gm_mode text)
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

  select * into v_campaign from campaigns where id = p_campaign_id;
  if not found then
    raise exception 'campaign not found';
  end if;

  if v_campaign.owner <> v_uid then
    raise exception 'only the campaign owner can change its GM mode';
  end if;

  update campaigns set gm_mode = p_gm_mode where id = p_campaign_id
  returning * into v_campaign;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (p_campaign_id, v_uid, 'gm_mode_changed', jsonb_build_object('gm_mode', p_gm_mode));

  return v_campaign;
end;
$$;

grant execute on function update_campaign_gm_mode(uuid, text) to authenticated;
revoke execute on function update_campaign_gm_mode(uuid, text) from public;
revoke execute on function update_campaign_gm_mode(uuid, text) from anon;
