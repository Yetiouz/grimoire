-- gm_record_turn gains p_mode, so the telemetry can tell a rules lookup
-- from a turn of play. Defaulted, so any caller that doesn't pass it
-- still records as 'play' — no behaviour change for existing callers.
create or replace function gm_record_turn(
  p_campaign_id   uuid,
  p_session_id    uuid,
  p_status        text,
  p_request_count int,
  p_input_tokens  int    default null,
  p_output_tokens int    default null,
  p_transcript    jsonb  default null,
  p_inventions    jsonb  default null,
  p_error         text   default null,
  p_mode          text   default 'play'
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
    input_tokens, output_tokens, transcript, inventions, error, mode
  ) values (
    p_campaign_id, p_session_id, v_user, p_status, p_request_count,
    p_input_tokens, p_output_tokens, p_transcript, p_inventions, p_error, p_mode
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- The old 9-argument signature would otherwise linger and be chosen for
-- calls that omit p_mode, quietly bypassing the new column.
drop function if exists gm_record_turn(uuid, uuid, text, int, int, int, jsonb, jsonb, text);

revoke all on function gm_record_turn(uuid, uuid, text, int, int, int, jsonb, jsonb, text, text) from public, anon;
grant execute on function gm_record_turn(uuid, uuid, text, int, int, int, jsonb, jsonb, text, text) to authenticated;
