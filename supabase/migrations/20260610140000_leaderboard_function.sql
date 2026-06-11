-- =============================================================================
-- get_leaderboard()
--
-- Returns one ranked row per profile, summing match + group-table points.
-- Tie-break order (matches _docs/claude.md §5):
--   1. total_points  DESC
--   2. exact_hits    DESC  (count of match predictions worth 5)
--   3. first_submitted_at  ASC NULLS LAST
--
-- SECURITY DEFINER so the aggregation can cross all users — RLS on
-- match_predictions / group_table_predictions otherwise restricts callers to
-- their own rows, which would produce a leaderboard of one.
-- =============================================================================

create or replace function public.get_leaderboard()
returns table (
  user_id           uuid,
  display_name      text,
  first_submitted_at timestamptz,
  total_points      int,
  exact_hits        int,
  rank              int
)
language sql
security definer
set search_path = public
as $$
  with match_totals as (
    select
      user_id,
      coalesce(sum(points), 0)::int as match_points,
      (count(*) filter (where points = 5))::int as exact_hits
    from public.match_predictions
    group by user_id
  ),
  group_totals as (
    select
      user_id,
      coalesce(sum(points), 0)::int as group_points
    from public.group_table_predictions
    group by user_id
  )
  select
    p.id as user_id,
    p.display_name,
    p.first_submitted_at,
    (coalesce(mt.match_points, 0) + coalesce(gt.group_points, 0))::int
        as total_points,
    coalesce(mt.exact_hits, 0)::int as exact_hits,
    (row_number() over (
      order by
        coalesce(mt.match_points, 0) + coalesce(gt.group_points, 0) desc,
        coalesce(mt.exact_hits, 0) desc,
        p.first_submitted_at asc nulls last
    ))::int as rank
  from public.profiles p
  left join match_totals mt on mt.user_id = p.id
  left join group_totals  gt on gt.user_id = p.id;
$$;

grant execute on function public.get_leaderboard() to authenticated;
