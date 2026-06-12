-- =============================================================================
-- Move scoring logic from SQL into the application layer.
--
-- Before: recompute_scores() and get_leaderboard() were plpgsql functions that
-- mirrored the rules already encoded in lib/scoring/{score,standings}.ts.
-- Maintaining two parallel implementations was a sync hazard, and the SQL
-- path silently failed under pg_safeupdate (unconditional UPDATEs) and
-- reject_writes_after_lock (writes blocked after the deadline).
--
-- After: TypeScript owns scoring end-to-end. The cache layout is unchanged —
-- .points columns and actual_group_standings still exist — but the writer
-- and the reader both live in /lib/scoring/. saveMatchResult() calls a
-- service-role TS recomputeScores() that rewrites the cache; the leaderboard
-- and scorecard pages read the cache as before.
--
-- Net effect of this migration:
--   * recompute_scores()  — DROPPED (replaced by lib/scoring/recompute.ts).
--   * get_leaderboard()   — DROPPED (replaced by SUM in lib/scoring/leaderboard.ts).
--   * .points columns and actual_group_standings — KEPT.
--   * Predictions become readable across users once lock_at has passed, so the
--     leaderboard SUM in TS can see everyone's rows. Writes remain own-only.
-- =============================================================================

-- 1. Drop the SQL scoring functions. The cache tables they wrote to remain;
--    a TypeScript recompute now owns the writes.
drop function if exists public.get_leaderboard();
drop function if exists public.recompute_scores();

-- 2. Split the existing "own only" all-ops policy into a broader SELECT (so
--    the leaderboard can see across users once predictions are locked) and
--    owner-only write policies. Before lock_at, predictions stay private to
--    their author — same as today.

drop policy if exists "match predictions own only"
  on public.match_predictions;
drop policy if exists "group table predictions own only"
  on public.group_table_predictions;

create policy "match predictions readable"
  on public.match_predictions for select
  to authenticated
  using (
    auth.uid() = user_id
    or now() >= coalesce(
      (select lock_at from public.settings where id = 1),
      'infinity'::timestamptz
    )
  );

create policy "match predictions insertable by owner"
  on public.match_predictions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "match predictions updatable by owner"
  on public.match_predictions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "match predictions deletable by owner"
  on public.match_predictions for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "group table predictions readable"
  on public.group_table_predictions for select
  to authenticated
  using (
    auth.uid() = user_id
    or now() >= coalesce(
      (select lock_at from public.settings where id = 1),
      'infinity'::timestamptz
    )
  );

create policy "group table predictions insertable by owner"
  on public.group_table_predictions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "group table predictions updatable by owner"
  on public.group_table_predictions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "group table predictions deletable by owner"
  on public.group_table_predictions for delete
  to authenticated
  using (auth.uid() = user_id);
