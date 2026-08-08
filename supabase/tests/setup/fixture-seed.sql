-- fixture-seed.sql — satisfies migration 0004's out-of-band dependency.
--
-- 0004_black_road_import.sql is a data-backfill migration, not a from-
-- scratch-safe one: it inserts 144 journal entries, 3 characters, 17 npcs,
-- etc. against a specific campaign (id d20f78a5-20c7-4d27-9d47-b3d8c075b128)
-- and references three specific user ids as authors/members. In production
-- that campaign and those users already existed (created through the app,
-- not through any migration file) by the time 0004 ran. Discovered by
-- actually running the full migration chain from scratch — 0004 fails on a
-- foreign key otherwise. This is a real, minor instance of the "migration
-- drift" pattern: the migration file's history is incomplete without this
-- context, which is exactly why it's captured here rather than silently
-- worked around.
--
-- Run this — and only this — immediately before 0004. Every id below is
-- taken directly from what 0004 itself references.

insert into auth.users (id, email) values
  ('6b54f8ea-e47a-421a-8538-e65962b0d2ae', 'fixture-1@test.local'),
  ('a4d4fe17-be85-459d-ada2-a61b12e0446c', 'fixture-2@test.local'),
  ('e00ceebd-c2e7-472e-bc6e-feec654ab2a6', 'fixture-3@test.local')
on conflict (id) do nothing;

insert into campaigns (id, owner, name, system) values
  ('d20f78a5-20c7-4d27-9d47-b3d8c075b128', '6b54f8ea-e47a-421a-8538-e65962b0d2ae',
   'The Black Road (fixture)', 'shadowdark')
on conflict (id) do nothing;

-- characters.member_id in 0004 points at this exact campaign_members row,
-- not just at a user id — its own id (not user_id) is the FK target.
insert into campaign_members (id, campaign_id, user_id, role) values
  ('a4d4fe17-be85-459d-ada2-a61b12e0446c', 'd20f78a5-20c7-4d27-9d47-b3d8c075b128',
   'e00ceebd-c2e7-472e-bc6e-feec654ab2a6', 'owner')
on conflict (id) do nothing;
