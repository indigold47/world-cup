-- =============================================================================
-- recompute_scores()
--
-- Single-call recompute: from current `matches` results, derive group standings
-- and rewrite the .points column on every prediction in both prediction tables.
--
-- The same rules are encoded by the pure JS functions in lib/scoring/. Keep
-- the two in sync if you ever change the rules.
--
-- Idempotent: re-running yields identical .points everywhere.
-- =============================================================================

create or replace function public.recompute_scores()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  -- Admin gate. RLS would also block writes via service-invoker, but this
  -- function runs SECURITY DEFINER so we have to enforce it ourselves.
  select coalesce(role = 'admin', false) into v_is_admin
  from public.profiles where id = auth.uid();
  if not v_is_admin then
    raise exception 'Admin only' using errcode = 'P0001';
  end if;

  -- 1. Reset everyone's points to zero. Anything we don't explicitly award
  -- in the steps below stays at zero, which makes "clear a result" naturally
  -- correct (its prediction goes back to 0).
  update public.match_predictions set points = 0;
  update public.group_table_predictions set points = 0;

  -- 2. Award match-prediction points from finished matches. Exact match
  -- and outcome-match share a single CASE so exact is a flat 5 (not additive).
  update public.match_predictions mp set points = case
    when mp.home_goals = m.home_goals and mp.away_goals = m.away_goals then 5
    when sign(mp.home_goals - mp.away_goals) = sign(m.home_goals - m.away_goals) then 2
    else 0
  end
  from public.matches m
  where m.id = mp.match_id and m.status = 'finished';

  -- 3. Re-derive actual_group_standings. Wipe and reinsert: simpler than
  -- a diff, and the table is tiny.
  delete from public.actual_group_standings;

  insert into public.actual_group_standings (group_code, team_id, final_rank)
  with match_perspectives as (
    -- Each finished match contributes one row per team (home + away).
    select m.group_code, m.home_team_id as team_id,
           m.home_goals as gf, m.away_goals as ga
    from public.matches m where m.status = 'finished'
    union all
    select m.group_code, m.away_team_id as team_id,
           m.away_goals as gf, m.home_goals as ga
    from public.matches m where m.status = 'finished'
  ),
  team_stats as (
    select
      group_code,
      team_id,
      count(*) as games,
      sum(case when gf > ga then 3 when gf = ga then 1 else 0 end) as points,
      sum(gf) as gf_total,
      sum(gf - ga) as gd
    from match_perspectives
    group by group_code, team_id
  ),
  complete_groups as (
    -- A group is "complete" when its 4 teams have each played 3 games.
    select group_code from team_stats
    group by group_code
    having count(*) = 4 and min(games) = 3
  ),
  ranked as (
    select
      ts.group_code,
      ts.team_id,
      row_number() over (
        partition by ts.group_code
        order by ts.points desc, ts.gd desc, ts.gf_total desc
        -- Tie-break stops at GF; row_number() will pick an order for ties
        -- beyond that. See _docs/claude.md §5 for why this is intentional.
      ) as final_rank
    from team_stats ts
    where ts.group_code in (select group_code from complete_groups)
  )
  select group_code, team_id, final_rank from ranked;

  -- 4. Award 5 pts per correctly-placed team in groups that now have
  -- standings (incomplete groups got nothing in step 3, so this update
  -- naturally skips them).
  update public.group_table_predictions gtp set points = 5
  from public.actual_group_standings ags
  where ags.group_code = gtp.group_code
    and ags.team_id = gtp.team_id
    and ags.final_rank = gtp.predicted_rank;
end;
$$;

grant execute on function public.recompute_scores() to authenticated;
