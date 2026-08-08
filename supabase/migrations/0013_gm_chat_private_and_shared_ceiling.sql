-- ── 0013: rules chat goes private, budget gets a shared ceiling ──────

-- 1. The rules chat is yours alone.
--
-- Built member-scoped, matching every other table — correct for campaign
-- fiction, wrong for out-of-character table talk. Solo it made no
-- difference; the moment a second player joins it would mean everyone
-- reading everyone's questions, which nobody asked for.
drop policy if exists gm_chat_select_member on gm_chat;

create policy gm_chat_select_own
  on gm_chat for select
  using (user_id = auth.uid());


-- 2. Budget: one shared ceiling, with a per-player slice inside it.
--
-- The old gm_requests_since counted only the caller's own spend, which is
-- wrong when everyone draws on a single provider key: three players each
-- believing they had a full allowance would together promise far more
-- requests than the key can actually serve. The campaign total is the real
-- constraint; the per-player number exists so one person can't drain the
-- day before anyone else sits down.
create or replace function gm_budget_since(
  p_campaign_id uuid,
  p_since       timestamptz
)
returns table (campaign_used int, user_used int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
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

  return query
  select
    coalesce(sum(request_count), 0)::int,
    coalesce(sum(request_count) filter (where user_id = v_user), 0)::int
  from gm_turns
  where campaign_id = p_campaign_id
    and created_at >= p_since;
end;
$$;

revoke all on function gm_budget_since(uuid, timestamptz) from public, anon;
grant execute on function gm_budget_since(uuid, timestamptz) to authenticated;

-- Superseded: it counted across all campaigns for one user, which was
-- both too narrow (ignored other players) and too broad (ignored which
-- campaign the spend belonged to).
drop function if exists gm_requests_since(timestamptz);
