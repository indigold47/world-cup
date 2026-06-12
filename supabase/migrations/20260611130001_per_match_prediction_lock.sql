-- =============================================================================
-- Per-match prediction lock.
--
-- Adds matches.predictions_locked so admins can freeze a single match's
-- predictions independently of the global settings.lock_at deadline.
-- The reject_writes_after_lock() trigger now ALSO refuses a write when the
-- target match is individually locked.
-- =============================================================================

alter table public.matches
  add column if not exists predictions_locked boolean not null default false;

create or replace function public.reject_writes_after_lock()
returns trigger
language plpgsql
as $$
declare
  v_lock_at  timestamptz;
  v_locked   boolean;
begin
  -- Service role / scoring engine bypass.
  if auth.uid() is null then
    return new;
  end if;
  -- Scoring engine bypass: recompute_scores() sets this for its transaction.
  if coalesce(current_setting('app.bypass_lock', true), '') = 'on' then
    return new;
  end if;

  -- Per-match lock: only meaningful on match_predictions, which carries match_id.
  if tg_table_name = 'match_predictions' then
    select predictions_locked into v_locked
    from public.matches where id = new.match_id;
    if coalesce(v_locked, false) then
      raise exception 'Predictions for this match are locked'
        using errcode = 'P0001';
    end if;
  end if;

  select lock_at into v_lock_at from public.settings where id = 1;
  if v_lock_at is not null and now() >= v_lock_at then
    raise exception 'Predictions are locked'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;
