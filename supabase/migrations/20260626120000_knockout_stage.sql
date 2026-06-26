-- =============================================================================
-- Knockout stage support.
--
-- Purely additive — no existing group-stage row is touched. No new column on
-- `matches`: we use `match_no` ranges as the round discriminator
-- (1..72 = group, 73..88 = R32, 89..96 = R16, 97..100 = QF, 101..102 = SF,
--  103 = Final). Keeping it column-free means the app code doesn't depend on
-- this migration being applied to render existing data.
--
-- We:
--   1. Lift the match_no 1..72 cap to 1..200 so knockout fixtures (73+) fit.
--   2. Drop NOT NULL on home/away team, group_code, and match_date so the
--      bracket can be seeded with TBD opponents and TBD dates as the round
--      fills in. A CHECK keeps existing 72 group rows always complete.
--   3. Make the prediction-lock trigger round-aware (via match_no): the
--      global `settings.lock_at` is the GROUP-stage deadline only. Knockout
--      matches use only their per-match `predictions_locked` flag.
--   4. Seed R32 placeholder slots from the public bracket. The 4 confirmed
--      matchups get teams; the rest carry NULLs that admins fill in from
--      /results as the group stage finishes.
-- =============================================================================

-- 1. Bump match_no range. Inline column CHECKs auto-name to
--    <table>_<column>_check, but we look it up by definition pattern so a
--    manually-renamed constraint doesn't make this migration brittle.
do $$
declare
  v_name text;
begin
  select conname into v_name
  from pg_constraint
  where conrelid = 'public.matches'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%match_no%between%';
  if v_name is not null then
    execute format('alter table public.matches drop constraint %I', v_name);
  end if;
end $$;
alter table public.matches drop constraint if exists matches_match_no_check;
alter table public.matches add constraint matches_match_no_check
  check (match_no between 1 and 200);

-- 2. Relax NOT NULLs. The pre-existing `group_code in (...)` check accepts
--    NULL (Postgres CHECKs reject only FALSE, not NULL), so no rewrite needed.
alter table public.matches alter column home_team_id drop not null;
alter table public.matches alter column away_team_id drop not null;
alter table public.matches alter column group_code   drop not null;
alter table public.matches alter column match_date   drop not null;

-- Belt + braces: existing match_no <= 72 (group) rows must stay complete.
-- The existing 72 rows already satisfy this, so the constraint adds without
-- needing to rewrite any data.
alter table public.matches drop constraint if exists matches_group_rows_complete;
alter table public.matches add constraint matches_group_rows_complete check (
  match_no > 72
  or (
    home_team_id is not null
    and away_team_id is not null
    and group_code is not null
    and match_date is not null
  )
);

-- 3. Make the prediction-lock trigger round-aware.
--    Before: settings.lock_at locked ALL prediction writes once it passed.
--    After:  settings.lock_at is the GROUP-stage deadline only. Knockout
--            matches are gated by their per-match `predictions_locked` flag —
--            admin flips it on right before kickoff. Group rows still respect
--            both the global deadline AND the per-match flag (unchanged).
create or replace function public.reject_writes_after_lock()
returns trigger
language plpgsql
as $$
declare
  v_lock_at  timestamptz;
  v_locked   boolean;
  v_match_no int;
begin
  -- Service role / scoring engine bypass.
  if auth.uid() is null then
    return new;
  end if;
  -- Scoring engine bypass: recompute_scores() sets this for its transaction.
  if coalesce(current_setting('app.bypass_lock', true), '') = 'on' then
    return new;
  end if;

  -- Per-match lock applies to both stages, and gives us the match_no at the
  -- same time so we can decide whether to enforce the global deadline.
  if tg_table_name = 'match_predictions' then
    select predictions_locked, match_no into v_locked, v_match_no
    from public.matches where id = new.match_id;
    if coalesce(v_locked, false) then
      raise exception 'Predictions for this match are locked'
        using errcode = 'P0001';
    end if;
  end if;

  -- group_table_predictions has no match_id — always group-stage, always
  -- subject to the global deadline. Group-stage match_predictions
  -- (match_no <= 72) also enforce it. Knockout (match_no > 72) skip it.
  if tg_table_name = 'group_table_predictions' or coalesce(v_match_no, 0) <= 72 then
    select lock_at into v_lock_at from public.settings where id = 1;
    if v_lock_at is not null and now() >= v_lock_at then
      raise exception 'Predictions are locked'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

-- 4. Seed R32 placeholders. Slots ordered to match the bracket the user
--    shared; only the 4 confirmed matchups have teams set today. Admin can
--    fill the rest via /results as group standings finalise.
with t as (select id, name from public.teams)
insert into public.matches (match_no, group_code, match_date, home_team_id, away_team_id)
values
  (73, null, '2026-06-28', (select id from t where name='South Africa'),           (select id from t where name='Canada')),
  (74, null, '2026-06-29', (select id from t where name='Netherlands'),            (select id from t where name='Morocco')),
  (75, null, '2026-06-29', (select id from t where name='Germany'),                null),
  (76, null, '2026-06-30', null,                                                   null),
  (77, null, '2026-07-01', null,                                                   null),
  (78, null, '2026-07-01', (select id from t where name='USA'),                    (select id from t where name='Bosnia and Herzegovina')),
  (79, null, '2026-07-02', null,                                                   null),
  (80, null, '2026-07-02', null,                                                   null),
  (81, null, '2026-06-29', (select id from t where name='Brazil'),                 (select id from t where name='Japan')),
  (82, null, '2026-06-30', (select id from t where name='Ivory Coast'),            null),
  (83, null, '2026-06-30', (select id from t where name='Mexico'),                 null)
on conflict (match_no) do nothing;
