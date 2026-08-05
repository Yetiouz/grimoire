-- 0005_character_colors.sql
-- SPEC's locked decision: "Each PC gets one assigned color used
-- everywhere: token ring, presence avatar, chat name, party HP list."
-- JournalScreen.tsx has carried a hardcoded PLAYER_COLOR placeholder
-- since Journal v1 Part B, explicitly flagged in its own comment:
-- "replace this constant once one exists" -- pending a real character
-- model. That model landed with the Black Road import; this closes the
-- gap by making color a real per-character column instead of continuing
-- to hardcode it client-side.
alter table characters add column color text;

update characters set color = '#9b5cff' where name = 'Kimbo Slice';
update characters set color = '#35f0ff' where name = 'Constantine';
update characters set color = '#39ff8f' where name = 'LaLa';
