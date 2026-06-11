-- Push the prediction deadline out so we can keep testing the app before
-- the actual tournament kicks off. End of day Jun 13, 2026 in UTC-5
-- (Voice123 local time) = 2026-06-14 04:59:59 UTC.
update public.settings
set    lock_at = '2026-06-14 04:59:59+00'
where  id = 1;
