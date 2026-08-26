-- 0036_campaign_system_select.sql
-- Owner request, 2026-08-26 ("we need to build in a wizard for that game
-- also") -- campaigns.system (migration 0001) has never had any way to
-- set it from the app: create_campaign always took the column's own
-- table default ('shadowdark'), same gap gm_mode had before migration
-- 0033 gave it an optional p_gm_mode parameter. This closes the same gap
-- for system, following that migration's exact shape.
--
-- CY_BORG's own character-creation wizard isn't built yet
-- (CharacterBuilder.tsx's hasRulesModule gate still shows an honest
-- "no builder for this system yet" empty state for it) -- but nothing
-- about letting an owner START a CY_BORG campaign depends on that wizard
-- existing. The Shop/CharacterSheet/getSystemDisplay side of CY_BORG
-- support already works today; only guided character creation is still
-- pending. Shipping the picker now, ahead of the wizard, unblocks GM-mode
-- chat play (the empty state's own suggested fallback) immediately
-- instead of waiting on the wizard to land first.

-- Same reasoning as 0033's own drop-and-recreate: a trailing DEFAULT
-- parameter makes create_campaign(text, text) and
-- create_campaign(text, text, text default ...) ambiguous to PostgreSQL's
-- overload resolution for a two-arg call, which would break every
-- existing create_campaign(p_name, p_gm_mode) call site rather than just
-- add to it.
drop function if exists create_campaign(text, text);

create or replace function create_campaign(p_name text, p_gm_mode text default 'solo', p_system text default 'shadowdark')
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

  insert into campaigns (owner, name, gm_mode, system)
  values (v_uid, p_name, p_gm_mode, p_system)
  returning * into v_campaign;

  insert into campaign_members (campaign_id, user_id, role)
  values (v_campaign.id, v_uid, 'owner');

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (v_campaign.id, v_uid, 'campaign_created', jsonb_build_object('name', p_name));

  return v_campaign;
end;
$$;

grant execute on function create_campaign(text, text, text) to authenticated;
revoke execute on function create_campaign(text, text, text) from public;
revoke execute on function create_campaign(text, text, text) from anon;
