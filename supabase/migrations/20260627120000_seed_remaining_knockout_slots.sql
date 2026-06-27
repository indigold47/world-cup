-- =============================================================================
-- Seed the rest of the knockout bracket as empty placeholders.
--
-- The first knockout migration only seeded 11 R32 rows that were visible in
-- the bracket the admin shared. We now pre-create every remaining knockout
-- slot (R32 fill, R16, QF, SF, Final) so admins can fill teams + dates from
-- /results as they're confirmed, without round-tripping through SQL.
--
-- Allocation (match_no):
--   84..88   remaining R32 (5)
--   89..96   R16            (8)
--   97..100  QF             (4)
--   101..102 SF             (2)
--   103      Final          (1)
--
-- Idempotent on re-run via ON CONFLICT DO NOTHING.
-- =============================================================================

insert into public.matches (match_no, group_code, match_date, home_team_id, away_team_id)
select g.n, null, null, null, null
from generate_series(84, 103) as g(n)
on conflict (match_no) do nothing;
