-- 0023_campaign_invites.sql
-- Adds the join-by-code invite flow (2026-08-11, "I may want to play a
-- different character with my friends") -- Grimoire had NO way for a
-- second real person to get into an existing campaign at all before
-- this: campaign_members only ever gained a row via create_campaign's
-- own insert of its creator. Chosen shape, per the owner's call: one
-- persistent, shareable code per campaign (not a per-person invite
-- with expiry/email-matching) -- "GitHub is basically the admin
-- password, this is everyone else's."
--
-- campaign_members already has everything this needs: role (always
-- 'owner' until now, no CHECK constraint restricting it, so 'player'
-- needs no schema change) and a UNIQUE (campaign_id, user_id)
-- constraint (campaign_members_campaign_id_user_id_key, already live)
-- that join_campaign_by_code leans on for idempotency instead of a
-- fresh existence check.

alter table campaigns add column join_code text unique;

-- Owner-only, idempotent: returns the existing code if one's already
-- been generated (so re-opening the Invite dialog never invalidates a
-- code already handed out), otherwise mints one and stores it. A tiny
-- retry loop guards the vanishingly unlikely case of a fresh 8-char
-- code colliding with another campaign's.
create or replace function ensure_campaign_join_code(p_campaign_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_campaign campaigns;
  v_code text;
  v_attempt int := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_campaign from campaigns where id = p_campaign_id;
  if not found then
    raise exception 'campaign not found';
  end if;

  if v_campaign.owner <> v_uid then
    raise exception 'only the campaign owner can view or create its invite code';
  end if;

  if v_campaign.join_code is not null then
    return v_campaign.join_code;
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 8));
    begin
      update campaigns set join_code = v_code where id = p_campaign_id and join_code is null;
      exit;
    exception when unique_violation then
      if v_attempt >= 5 then
        raise exception 'could not generate a unique invite code -- try again';
      end if;
    end;
  end loop;

  return v_code;
end;
$$;

grant execute on function ensure_campaign_join_code(uuid) to authenticated;
revoke execute on function ensure_campaign_join_code(uuid) from public;
revoke execute on function ensure_campaign_join_code(uuid) from anon;

-- Any authenticated user, matched purely by code -- no membership check
-- on the way in (that's the point: this is how you get your first
-- membership row in someone else's campaign). Idempotent via the
-- existing unique(campaign_id, user_id) constraint rather than a
-- separate pre-check -- re-entering a code you've already redeemed is
-- a harmless no-op, not an error.
create or replace function join_campaign_by_code(p_code text)
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

  select * into v_campaign from campaigns where join_code = upper(btrim(p_code));
  if not found then
    raise exception 'invalid invite code';
  end if;

  insert into campaign_members (campaign_id, user_id, role)
  values (v_campaign.id, v_uid, 'player')
  on conflict (campaign_id, user_id) do nothing;

  if not exists (
    select 1 from campaign_events
    where campaign_id = v_campaign.id and actor = v_uid and kind = 'member_joined'
  ) then
    insert into campaign_events (campaign_id, actor, kind, payload)
    values (v_campaign.id, v_uid, 'member_joined', '{}'::jsonb);
  end if;

  return v_campaign;
end;
$$;

grant execute on function join_campaign_by_code(text) to authenticated;
revoke execute on function join_campaign_by_code(text) from public;
revoke execute on function join_campaign_by_code(text) from anon;
