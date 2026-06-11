-- =============================================================================
-- Office World Cup Prediction Game — initial schema, RLS, triggers, and seed.
--
-- One-file migration: tables, policies, the lock trigger, the auth trigger
-- (with company-domain enforcement + admin allowlist), then the tournament
-- seed (48 teams, 72 matches, settings row).
--
-- To apply:   npx supabase db push
-- To rebuild types after applying:
--             npx supabase gen types typescript --linked \
--               > lib/supabase/database.types.ts
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  display_name       text not null,
  role               text not null default 'player'
                       check (role in ('player', 'admin')),
  first_submitted_at timestamptz,
  created_at         timestamptz not null default now()
);

create table public.teams (
  id          serial primary key,
  name        text not null unique,
  group_code  text not null check (group_code in
              ('A','B','C','D','E','F','G','H','I','J','K','L'))
);
create index teams_group_code_idx on public.teams(group_code);

create table public.matches (
  id            serial primary key,
  match_no      int not null unique check (match_no between 1 and 72),
  group_code    text not null,
  match_date    date not null,
  home_team_id  int not null references public.teams(id),
  away_team_id  int not null references public.teams(id),
  home_goals    int check (home_goals between 0 and 30),
  away_goals    int check (away_goals between 0 and 30),
  status        text not null default 'scheduled'
                  check (status in ('scheduled', 'finished')),
  check (home_team_id <> away_team_id)
);
create index matches_group_code_idx on public.matches(group_code);
create index matches_match_date_idx on public.matches(match_date);

create table public.match_predictions (
  id          serial primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  match_id    int  not null references public.matches(id) on delete cascade,
  home_goals  int  not null check (home_goals between 0 and 20),
  away_goals  int  not null check (away_goals between 0 and 20),
  points      int  not null default 0,
  updated_at  timestamptz not null default now(),
  unique(user_id, match_id)
);
create index match_predictions_user_idx on public.match_predictions(user_id);
create index match_predictions_match_idx on public.match_predictions(match_id);

create table public.group_table_predictions (
  id              serial primary key,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  group_code      text not null,
  team_id         int  not null references public.teams(id) on delete cascade,
  predicted_rank  int  not null check (predicted_rank between 1 and 4),
  points          int  not null default 0,
  unique(user_id, group_code, team_id),
  unique(user_id, group_code, predicted_rank)
);
create index group_table_predictions_user_idx
  on public.group_table_predictions(user_id);

create table public.actual_group_standings (
  group_code  text not null,
  team_id     int  not null references public.teams(id) on delete cascade,
  final_rank  int  not null check (final_rank between 1 and 4),
  primary key (group_code, team_id),
  unique (group_code, final_rank)
);

create table public.settings (
  id       int primary key default 1 check (id = 1),
  lock_at  timestamptz not null
);


-- ---------------------------------------------------------------------------
-- Helper: is_admin() — used by RLS policies, avoids inline subqueries
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;


-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles                enable row level security;
alter table public.teams                   enable row level security;
alter table public.matches                 enable row level security;
alter table public.match_predictions       enable row level security;
alter table public.group_table_predictions enable row level security;
alter table public.actual_group_standings  enable row level security;
alter table public.settings                enable row level security;

-- profiles: anyone signed in can read (leaderboard needs names);
-- a user can only update their own row. Inserts happen via the auth trigger
-- (security definer), so no INSERT policy is needed.
create policy "profiles readable to authenticated"
  on public.profiles for select
  to authenticated using (true);

create policy "profiles updatable by owner"
  on public.profiles for update
  to authenticated
  using  (auth.uid() = id)
  with check (auth.uid() = id);

-- teams / matches / actual_group_standings / settings:
-- everyone signed in reads; only admins write.
create policy "teams readable" on public.teams for select to authenticated using (true);
create policy "teams writable by admin" on public.teams for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "matches readable" on public.matches for select to authenticated using (true);
create policy "matches writable by admin" on public.matches for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "standings readable" on public.actual_group_standings
  for select to authenticated using (true);
create policy "standings writable by admin" on public.actual_group_standings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "settings readable" on public.settings for select to authenticated using (true);
create policy "settings writable by admin" on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- match_predictions / group_table_predictions: own rows only.
-- (The scoring engine writes via service role, which bypasses RLS.)
create policy "match predictions own only"
  on public.match_predictions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "group table predictions own only"
  on public.group_table_predictions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- Lock trigger — reject prediction writes after `settings.lock_at`.
--
-- Bypasses when `auth.uid()` is null (service role / scoring engine),
-- so recomputed point updates after the lock still succeed.
-- ---------------------------------------------------------------------------

create or replace function public.reject_writes_after_lock()
returns trigger
language plpgsql
as $$
declare
  v_lock_at timestamptz;
begin
  if auth.uid() is null then
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

create trigger lock_match_predictions
  before insert or update on public.match_predictions
  for each row execute function public.reject_writes_after_lock();

create trigger lock_group_table_predictions
  before insert or update on public.group_table_predictions
  for each row execute function public.reject_writes_after_lock();


-- ---------------------------------------------------------------------------
-- Auth trigger — creates a profile on signup.
--
-- Two policies enforced here:
--   1. Reject any email that doesn't end with @voice123.com.
--   2. Bootstrap admins from a hardcoded allowlist (edit & re-migrate to add).
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_emails text[] := array[
    'nathalia@voice123.com'  -- add more admins here, then re-migrate
  ];
  v_display_name text;
  v_role         text;
begin
  if new.email is null or new.email not ilike '%@voice123.com' then
    raise exception 'Sign-ups are restricted to @voice123.com Google accounts.'
      using errcode = 'P0001';
  end if;

  v_display_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  v_role := case
    when lower(new.email) = any (v_admin_emails) then 'admin'
    else 'player'
  end;

  insert into public.profiles (id, display_name, role)
  values (new.id, v_display_name, v_role);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------------
-- Seed: 48 teams, 72 matches, one settings row.
--
-- Idempotent on re-run via ON CONFLICT DO NOTHING — safe to re-apply.
-- ---------------------------------------------------------------------------

insert into public.teams (name, group_code) values
  ('Mexico', 'A'), ('South Africa', 'A'), ('South Korea', 'A'), ('Czech Republic', 'A'),
  ('Canada', 'B'), ('Bosnia and Herzegovina', 'B'), ('Qatar', 'B'), ('Switzerland', 'B'),
  ('Brazil', 'C'), ('Morocco', 'C'), ('Haiti', 'C'), ('Scotland', 'C'),
  ('USA', 'D'), ('Paraguay', 'D'), ('Australia', 'D'), ('Turkey', 'D'),
  ('Germany', 'E'), ('Curaçao', 'E'), ('Ivory Coast', 'E'), ('Ecuador', 'E'),
  ('Netherlands', 'F'), ('Japan', 'F'), ('Sweden', 'F'), ('Tunisia', 'F'),
  ('Belgium', 'G'), ('Egypt', 'G'), ('Iran', 'G'), ('New Zealand', 'G'),
  ('Spain', 'H'), ('Cape Verde', 'H'), ('Saudi Arabia', 'H'), ('Uruguay', 'H'),
  ('France', 'I'), ('Senegal', 'I'), ('Iraq', 'I'), ('Norway', 'I'),
  ('Argentina', 'J'), ('Algeria', 'J'), ('Austria', 'J'), ('Jordan', 'J'),
  ('Portugal', 'K'), ('DR Congo', 'K'), ('Uzbekistan', 'K'), ('Colombia', 'K'),
  ('England', 'L'), ('Croatia', 'L'), ('Ghana', 'L'), ('Panama', 'L')
on conflict (name) do nothing;

-- Helper for compact match inserts: look up team id by name.
-- Using a CTE so each SELECT in the VALUES list doesn't re-hit the table.
with t as (select id, name from public.teams)
insert into public.matches (match_no, group_code, match_date, home_team_id, away_team_id)
values
  (1,  'A', '2026-06-11', (select id from t where name='Mexico'),                (select id from t where name='South Africa')),
  (2,  'A', '2026-06-11', (select id from t where name='South Korea'),           (select id from t where name='Czech Republic')),
  (3,  'A', '2026-06-18', (select id from t where name='Czech Republic'),        (select id from t where name='South Africa')),
  (4,  'A', '2026-06-18', (select id from t where name='Mexico'),                (select id from t where name='South Korea')),
  (5,  'A', '2026-06-24', (select id from t where name='Czech Republic'),        (select id from t where name='Mexico')),
  (6,  'A', '2026-06-24', (select id from t where name='South Africa'),          (select id from t where name='South Korea')),
  (7,  'B', '2026-06-12', (select id from t where name='Canada'),                (select id from t where name='Bosnia and Herzegovina')),
  (8,  'B', '2026-06-13', (select id from t where name='Qatar'),                 (select id from t where name='Switzerland')),
  (9,  'B', '2026-06-18', (select id from t where name='Switzerland'),           (select id from t where name='Bosnia and Herzegovina')),
  (10, 'B', '2026-06-18', (select id from t where name='Canada'),                (select id from t where name='Qatar')),
  (11, 'B', '2026-06-24', (select id from t where name='Switzerland'),           (select id from t where name='Canada')),
  (12, 'B', '2026-06-24', (select id from t where name='Bosnia and Herzegovina'),(select id from t where name='Qatar')),
  (13, 'C', '2026-06-13', (select id from t where name='Brazil'),                (select id from t where name='Morocco')),
  (14, 'C', '2026-06-13', (select id from t where name='Haiti'),                 (select id from t where name='Scotland')),
  (15, 'C', '2026-06-19', (select id from t where name='Scotland'),              (select id from t where name='Morocco')),
  (16, 'C', '2026-06-19', (select id from t where name='Brazil'),                (select id from t where name='Haiti')),
  (17, 'C', '2026-06-24', (select id from t where name='Scotland'),              (select id from t where name='Brazil')),
  (18, 'C', '2026-06-24', (select id from t where name='Morocco'),               (select id from t where name='Haiti')),
  (19, 'D', '2026-06-12', (select id from t where name='USA'),                   (select id from t where name='Paraguay')),
  (20, 'D', '2026-06-13', (select id from t where name='Australia'),             (select id from t where name='Turkey')),
  (21, 'D', '2026-06-19', (select id from t where name='USA'),                   (select id from t where name='Australia')),
  (22, 'D', '2026-06-19', (select id from t where name='Turkey'),                (select id from t where name='Paraguay')),
  (23, 'D', '2026-06-25', (select id from t where name='Turkey'),                (select id from t where name='USA')),
  (24, 'D', '2026-06-25', (select id from t where name='Paraguay'),              (select id from t where name='Australia')),
  (25, 'E', '2026-06-14', (select id from t where name='Germany'),               (select id from t where name='Curaçao')),
  (26, 'E', '2026-06-14', (select id from t where name='Ivory Coast'),           (select id from t where name='Ecuador')),
  (27, 'E', '2026-06-20', (select id from t where name='Germany'),               (select id from t where name='Ivory Coast')),
  (28, 'E', '2026-06-20', (select id from t where name='Ecuador'),               (select id from t where name='Curaçao')),
  (29, 'E', '2026-06-25', (select id from t where name='Ecuador'),               (select id from t where name='Germany')),
  (30, 'E', '2026-06-25', (select id from t where name='Curaçao'),               (select id from t where name='Ivory Coast')),
  (31, 'F', '2026-06-14', (select id from t where name='Netherlands'),           (select id from t where name='Japan')),
  (32, 'F', '2026-06-14', (select id from t where name='Sweden'),                (select id from t where name='Tunisia')),
  (33, 'F', '2026-06-20', (select id from t where name='Netherlands'),           (select id from t where name='Sweden')),
  (34, 'F', '2026-06-20', (select id from t where name='Tunisia'),               (select id from t where name='Japan')),
  (35, 'F', '2026-06-25', (select id from t where name='Japan'),                 (select id from t where name='Sweden')),
  (36, 'F', '2026-06-25', (select id from t where name='Tunisia'),               (select id from t where name='Netherlands')),
  (37, 'G', '2026-06-15', (select id from t where name='Belgium'),               (select id from t where name='Egypt')),
  (38, 'G', '2026-06-15', (select id from t where name='Iran'),                  (select id from t where name='New Zealand')),
  (39, 'G', '2026-06-21', (select id from t where name='Belgium'),               (select id from t where name='Iran')),
  (40, 'G', '2026-06-21', (select id from t where name='New Zealand'),           (select id from t where name='Egypt')),
  (41, 'G', '2026-06-26', (select id from t where name='Egypt'),                 (select id from t where name='Iran')),
  (42, 'G', '2026-06-26', (select id from t where name='New Zealand'),           (select id from t where name='Belgium')),
  (43, 'H', '2026-06-15', (select id from t where name='Spain'),                 (select id from t where name='Cape Verde')),
  (44, 'H', '2026-06-15', (select id from t where name='Saudi Arabia'),          (select id from t where name='Uruguay')),
  (45, 'H', '2026-06-21', (select id from t where name='Spain'),                 (select id from t where name='Saudi Arabia')),
  (46, 'H', '2026-06-21', (select id from t where name='Uruguay'),               (select id from t where name='Cape Verde')),
  (47, 'H', '2026-06-26', (select id from t where name='Cape Verde'),            (select id from t where name='Saudi Arabia')),
  (48, 'H', '2026-06-26', (select id from t where name='Uruguay'),               (select id from t where name='Spain')),
  (49, 'I', '2026-06-16', (select id from t where name='France'),                (select id from t where name='Senegal')),
  (50, 'I', '2026-06-16', (select id from t where name='Iraq'),                  (select id from t where name='Norway')),
  (51, 'I', '2026-06-22', (select id from t where name='France'),                (select id from t where name='Iraq')),
  (52, 'I', '2026-06-22', (select id from t where name='Norway'),                (select id from t where name='Senegal')),
  (53, 'I', '2026-06-26', (select id from t where name='Norway'),                (select id from t where name='France')),
  (54, 'I', '2026-06-26', (select id from t where name='Senegal'),               (select id from t where name='Iraq')),
  (55, 'J', '2026-06-16', (select id from t where name='Argentina'),             (select id from t where name='Algeria')),
  (56, 'J', '2026-06-16', (select id from t where name='Austria'),               (select id from t where name='Jordan')),
  (57, 'J', '2026-06-22', (select id from t where name='Argentina'),             (select id from t where name='Austria')),
  (58, 'J', '2026-06-22', (select id from t where name='Jordan'),                (select id from t where name='Algeria')),
  (59, 'J', '2026-06-27', (select id from t where name='Algeria'),               (select id from t where name='Austria')),
  (60, 'J', '2026-06-27', (select id from t where name='Jordan'),                (select id from t where name='Argentina')),
  (61, 'K', '2026-06-17', (select id from t where name='Portugal'),              (select id from t where name='DR Congo')),
  (62, 'K', '2026-06-17', (select id from t where name='Uzbekistan'),            (select id from t where name='Colombia')),
  (63, 'K', '2026-06-23', (select id from t where name='Portugal'),              (select id from t where name='Uzbekistan')),
  (64, 'K', '2026-06-23', (select id from t where name='Colombia'),              (select id from t where name='DR Congo')),
  (65, 'K', '2026-06-27', (select id from t where name='Colombia'),              (select id from t where name='Portugal')),
  (66, 'K', '2026-06-27', (select id from t where name='DR Congo'),              (select id from t where name='Uzbekistan')),
  (67, 'L', '2026-06-17', (select id from t where name='England'),               (select id from t where name='Croatia')),
  (68, 'L', '2026-06-17', (select id from t where name='Ghana'),                 (select id from t where name='Panama')),
  (69, 'L', '2026-06-23', (select id from t where name='England'),               (select id from t where name='Ghana')),
  (70, 'L', '2026-06-23', (select id from t where name='Panama'),                (select id from t where name='Croatia')),
  (71, 'L', '2026-06-27', (select id from t where name='Panama'),                (select id from t where name='England')),
  (72, 'L', '2026-06-27', (select id from t where name='Croatia'),               (select id from t where name='Ghana'))
on conflict (match_no) do nothing;

insert into public.settings (id, lock_at)
values (1, '2026-06-11 00:00:00+00')
on conflict (id) do nothing;
