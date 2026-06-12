-- =============================================================================
-- Fix: recompute_scores() was silently failing after the prediction deadline.
--
-- reject_writes_after_lock() was designed to bypass when auth.uid() is null
-- (intended for the scoring engine running as service role). recompute_scores()
-- is SECURITY DEFINER but is called from an admin's session, so the JWT
-- claims — and therefore auth.uid() — are still the admin's UID inside the
-- function. After lock_at passes, the trigger fires on the recompute UPDATEs
-- and raises 'Predictions are locked', so the admin saves a result, the match
-- row is updated, but no prediction.points are ever recomputed, and the
-- leaderboard stays at 0 for everyone.
--
-- Fix: recompute_scores() sets a transaction-local flag before touching
-- predictions; the trigger respects the flag.
-- =============================================================================

create or replace function public.reject_writes_after_lock()
returns trigger
language plpgsql
as $$
declare
  v_lock_at timestamptz;
begin
  -- Service role / scoring engine bypass.
  if auth.uid() is null then
    return new;
  end if;
  -- Scoring engine bypass: recompute_scores() sets this for its transaction.
  if coalesce(current_setting('app.bypass_lock', true), '') = 'on' then
    return new;
  end if;

  select lock_at into v_lock_at from public.settings where id = 1;
  if v_lock_at is not null and now() >= v_lock_at then
    raise exception 'Predictions are locked'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- Re-declare recompute_scores with the bypass flag set up-front. Body is
-- otherwise identical to 20260610130000_recompute_function.sql — keep both
-- in sync if the scoring rules ever change.
create or replace function public.recompute_scores()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  select coalesce(role = 'admin', false) into v_is_admin
  from public.profiles where id = auth.uid();
  if not v_is_admin then
    raise exception 'Admin only' using errcode = 'P0001';
  end if;

  -- Tell reject_writes_after_lock() that the writes below come from the
  -- scoring engine, not a player editing their prediction. Transaction-local
  -- (third arg = true) so it auto-clears at txn end and can't leak.
  perform set_config('app.bypass_lock', 'on', true);

  update public.match_predictions set points = 0;
  update public.group_table_predictions set points = 0;

  update public.match_predictions mp set points = case
    when mp.home_goals = m.home_goals and mp.away_goals = m.away_goals then 5
    when sign(mp.home_goals - mp.away_goals) = sign(m.home_goals - m.away_goals) then 2
    else 0
  end
  from public.matches m
  where m.id = mp.match_id and m.status = 'finished';

  delete from public.actual_group_standings;

  insert into public.actual_group_standings (group_code, team_id, final_rank)
  with match_perspectives as (
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
      ) as final_rank
    from team_stats ts
    where ts.group_code in (select group_code from complete_groups)
  )
  select group_code, team_id, final_rank from ranked;

  update public.group_table_predictions gtp set points = 5
  from public.actual_group_standings ags
  where ags.group_code = gtp.group_code
    and ags.team_id = gtp.team_id
    and ags.final_rank = gtp.predicted_rank;
end;
$$;

grant execute on function public.recompute_scores() to authenticated;
