-- 0019: campaigns.gm_mode (BOB_queue item 5, folded into slice 17).
--
-- Closes two things at once: the header's hardcoded "SOLO" becomes a
-- real value, and the Ask GM surface gains a per-campaign gate instead
-- of the build-wide VITE_GM_ENABLED alone (the day other players join,
-- a human-run campaign must not show an Ask GM button).

alter table campaigns add column gm_mode text not null default 'solo'
  check (gm_mode in ('solo', 'ai', 'human'));

-- The Black Road is AI-run today.
update campaigns set gm_mode = 'ai';
