-- Server-authoritative dice (BUILD_PLAN.md slice 4). A pure RNG
-- primitive, not a journal write: results are generated with Postgres's
-- own random() specifically so they can't be faked or replayed by the
-- client. The caller (JournalScreen, via lib/dice.ts) composes the
-- display text and logs it through the existing log_journal_entry
-- command — this function doesn't touch journal_entries or
-- campaign_events at all.
--
-- Same SECURITY DEFINER convention as every other command in this
-- project (see 0001_journal_v1.sql's start_session): auth check,
-- membership check, then grant/revoke all done together in this one
-- migration (the lesson from 0002/0003, applied from the start this
-- time instead of needing a follow-up fix).
--
-- Advantage/disadvantage roll two full sets of p_count dice and keep
-- whichever set's sum is better/worse — not just two individual dice —
-- so "2d20 kept 18" (advantage on a single d20 check) and, say,
-- advantage on a 2d6 damage roll both fall out of the same logic.
create or replace function roll_dice(
  p_campaign_id uuid,
  p_die text,
  p_count int default 1,
  p_mode text default 'normal'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $
declare
  v_uid uuid := auth.uid();
  v_faces int;
  v_set_a int[];
  v_set_b int[];
  v_sum_a int;
  v_sum_b int;
  v_kept int[];
  v_other int[];
  v_total int;
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

  v_faces := case p_die
    when 'd4' then 4
    when 'd6' then 6
    when 'd8' then 8
    when 'd10' then 10
    when 'd12' then 12
    when 'd20' then 20
    else null
  end;
  if v_faces is null then
    raise exception 'unsupported die: %', p_die;
  end if;

  if p_count is null or p_count < 1 or p_count > 20 then
    raise exception 'count must be between 1 and 20';
  end if;

  if p_mode not in ('normal', 'advantage', 'disadvantage') then
    raise exception 'unsupported mode: %', p_mode;
  end if;

  v_set_a := array(select floor(random() * v_faces)::int + 1 from generate_series(1, p_count));
  v_sum_a := (select sum(x) from unnest(v_set_a) as x);

  if p_mode = 'normal' then
    v_kept := v_set_a;
    v_other := null;
    v_total := v_sum_a;
  else
    v_set_b := array(select floor(random() * v_faces)::int + 1 from generate_series(1, p_count));
    v_sum_b := (select sum(x) from unnest(v_set_b) as x);

    if (p_mode = 'advantage' and v_sum_a >= v_sum_b) or (p_mode = 'disadvantage' and v_sum_a <= v_sum_b) then
      v_kept := v_set_a;
      v_other := v_set_b;
      v_total := v_sum_a;
    else
      v_kept := v_set_b;
      v_other := v_set_a;
      v_total := v_sum_b;
    end if;
  end if;

  return jsonb_build_object(
    'die', p_die,
    'count', p_count,
    'mode', p_mode,
    'rolls', to_jsonb(v_kept),
    'otherRolls', case when v_other is null then null else to_jsonb(v_other) end,
    'total', v_total
  );
end;
$;

grant execute on function roll_dice(uuid, text, int, text) to authenticated;
revoke execute on function roll_dice(uuid, text, int, text) from public;
revoke execute on function roll_dice(uuid, text, int, text) from anon;
