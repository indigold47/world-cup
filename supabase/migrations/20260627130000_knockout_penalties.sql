-- =============================================================================
-- Knockout penalty shootouts.
--
-- A knockout match can end as a draw at 90 minutes and then be decided by a
-- penalty shootout. We store the shootout scores on `matches` (actual result)
-- and `match_predictions` (user's predicted shootout winner). Group-stage
-- rows never carry pens; they're free to tie.
--
-- Constraints we enforce in SQL:
--   - Pens must be set as a pair (both null OR both not null).
--   - Pens cannot tie (a shootout always has a winner).
--   - On `matches`: pens only on knockout rows (match_no > 72) AND only when
--     the 90-min goals are a draw.
--   - On `match_predictions`: pens only when the predicted 90-min score is a
--     draw. Knockout-only is enforced at the application layer rather than via
--     a trigger — saveMatchPrediction strips pens off group-match writes.
--
-- Idempotent: every constraint uses drop-if-exists before add.
-- =============================================================================

-- 1. Columns. Same 0..30 / 0..20 bounds as the goals columns they sit beside.
alter table public.matches
  add column if not exists home_pens int check (home_pens between 0 and 30);
alter table public.matches
  add column if not exists away_pens int check (away_pens between 0 and 30);

alter table public.match_predictions
  add column if not exists home_pens int check (home_pens between 0 and 20);
alter table public.match_predictions
  add column if not exists away_pens int check (away_pens between 0 and 20);

-- 2. Both-or-neither: a half-set pens pair would be a save bug.
alter table public.matches drop constraint if exists matches_pens_both_or_neither;
alter table public.matches add constraint matches_pens_both_or_neither check (
  (home_pens is null and away_pens is null)
  or (home_pens is not null and away_pens is not null)
);
alter table public.match_predictions drop constraint if exists match_predictions_pens_both_or_neither;
alter table public.match_predictions add constraint match_predictions_pens_both_or_neither check (
  (home_pens is null and away_pens is null)
  or (home_pens is not null and away_pens is not null)
);

-- 3. Pens never tie.
alter table public.matches drop constraint if exists matches_pens_no_tie;
alter table public.matches add constraint matches_pens_no_tie check (
  home_pens is null or away_pens is null or home_pens <> away_pens
);
alter table public.match_predictions drop constraint if exists match_predictions_pens_no_tie;
alter table public.match_predictions add constraint match_predictions_pens_no_tie check (
  home_pens is null or away_pens is null or home_pens <> away_pens
);

-- 4. Knockout-only and draw-only on matches.
alter table public.matches drop constraint if exists matches_pens_knockout_only;
alter table public.matches add constraint matches_pens_knockout_only check (
  home_pens is null or match_no > 72
);
alter table public.matches drop constraint if exists matches_pens_only_when_drawn;
alter table public.matches add constraint matches_pens_only_when_drawn check (
  home_pens is null
  or (home_goals is not null and away_goals is not null and home_goals = away_goals)
);

-- 5. Draw-only on predictions (the app enforces knockout-only).
alter table public.match_predictions drop constraint if exists match_predictions_pens_only_when_drawn;
alter table public.match_predictions add constraint match_predictions_pens_only_when_drawn check (
  home_pens is null or home_goals = away_goals
);
