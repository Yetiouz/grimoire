-- 0020: a check must belong to a session.
--
-- Found by the slice-17 live self-test: resolve_check ultimately calls
-- log_journal_entry, which (correctly) refuses a null session — so a
-- session-less check was creatable but never resolvable. An outcome
-- that can't reach the journal isn't an outcome. Enforce at the door:
-- the GM can only call for checks inside an open session, which matches
-- play reality (the composer is session-gated anyway).

create or replace function gm_create_check(
  p_campaign_id uuid,
  p_session_id uuid,
  p_character_id uuid,
  p_ability text,
  p_dc integer,
  p_advantage text,
  p_stakes text,
  p_bands jsonb
) returns uuid
language plpgsql security definer set search_path = public as $grim$
declare
  v_id uuid;
  v_band jsonb;
  v_prev_max integer := null;
  v_first_min integer := null;
  v_last_max integer := null;
begin
  if not gm_check_is_member(p_campaign_id) then
    raise exception 'not a member of this campaign';
  end if;
  if p_session_id is null then
    raise exception 'a check needs an open session';
  end if;
  if not exists (
    select 1 from sessions
    where id = p_session_id and campaign_id = p_campaign_id
  ) then
    raise exception 'session does not belong to this campaign';
  end if;
  if jsonb_typeof(p_bands) <> 'array' or jsonb_array_length(p_bands) < 2 then
    raise exception 'bands must be an array of at least 2';
  end if;
  for v_band in select * from jsonb_array_elements(p_bands) loop
    if v_band->>'text' is null or (v_band->>'min') is null or (v_band->>'max') is null then
      raise exception 'each band needs min, max, text';
    end if;
    if (v_band->>'min')::int > (v_band->>'max')::int then
      raise exception 'band min > max';
    end if;
    if v_first_min is null then
      v_first_min := (v_band->>'min')::int;
    elsif (v_band->>'min')::int <> v_prev_max + 1 then
      raise exception 'bands must be contiguous and ascending';
    end if;
    v_prev_max := (v_band->>'max')::int;
    v_last_max := v_prev_max;
  end loop;
  if v_first_min > -20 or v_last_max < 60 then
    raise exception 'bands must cover totals -20..60';
  end if;

  update gm_checks set status = 'abandoned'
  where campaign_id = p_campaign_id and status = 'pending';

  insert into gm_checks (campaign_id, session_id, character_id, ability, dc, advantage, stakes, bands)
  values (p_campaign_id, p_session_id, p_character_id, p_ability, p_dc, p_advantage, p_stakes, p_bands)
  returning id into v_id;
  return v_id;
end;
$grim$;

-- Retire the self-test's session-less orphan.
update gm_checks set status = 'abandoned' where status = 'pending' and session_id is null;
