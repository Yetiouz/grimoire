-- 0016: allow 'speak' in gm_turns.mode.
--
-- The read-aloud TTS path (edge function v11, mode "speak") records its
-- turns like every other mode — but 0011's check constraint predates it
-- and only allowed 'play'/'rules'. Because gm_record_turn is called
-- best-effort (a telemetry failure must never fail the turn), the
-- violation was swallowed silently: speak turns played fine, wrote no
-- row, and therefore ALSO didn't count against the daily budget, since
-- gm_budget_since sums request_count from exactly this table. Widening
-- the check restores both telemetry and honest budget accounting.
--
-- Applied to the live project 2026-08-09 and verified: a speak turn now
-- writes {mode:'speak', status:'ok', request_count:1}.

alter table gm_turns drop constraint gm_turns_mode_check;
alter table gm_turns add constraint gm_turns_mode_check
  check (mode = any (array['play'::text, 'rules'::text, 'speak'::text]));
