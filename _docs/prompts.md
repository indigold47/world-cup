### T1 — Project scaffold

```
Set up the project skeleton for the Office World Cup Prediction Game.

Do:
1. Initialize a Next.js (App Router) + TypeScript project with Tailwind CSS.
2. Install and initialize shadcn/ui. Add these components to start: button, card,
   input, label, dialog, sonner (toast), badge, table, avatar, skeleton, tabs.
3. Install the Supabase JS client (@supabase/supabase-js and @supabase/ssr).
   Create typed browser and server Supabase client helpers that read
   NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from env. Leave a
   `lib/supabase/database.types.ts` placeholder — T2 will generate the real one
   via `supabase gen types typescript`.
4. Install the Supabase CLI as a dev dependency and create a `supabase/` folder
   (so migrations and type generation live with the code, no separate tooling).
5. Install Vitest + @testing-library/react + jsdom. Add `npm test` script.
   Create a trivial `lib/scoring/score.test.ts` that asserts `1 === 1` so the
   runner is wired and ready for T9.
6. Create a .env.example listing all required env vars with comments
   (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).
7. Set up a clean folder structure: /app, /components, /lib (supabase clients,
   utils), /lib/scoring (empty for now), /data (tournament seed will live here),
   /supabase/migrations.
8. Add a basic global layout with the Inter font, a light/dark-friendly theme via
   CSS variables, and a centered max-width container.
9. Add a README with: local setup (env vars, install, run), how to run migrations
   (`supabase db push`), how to regenerate types, and a one-paragraph "Deploying
   to Vercel" section (link the repo, paste env vars, that's it — no custom
   build config needed).

Acceptance criteria:
- `npm run dev` starts with no errors and renders a placeholder home page.
- `npm test` runs Vitest and the placeholder test passes.
- shadcn components import and render.
- Supabase client helpers compile and are typed.
- No secrets are committed; .env.example documents everything.
```

---

### T2 — Database schema, RLS & tournament seed

```
Create the Supabase database schema, security policies, and seed the tournament
data for the Office World Cup Prediction Game.

Use the Supabase CLI: write one migration file under `supabase/migrations/` that
the CLI can apply with `supabase db push`. After it applies, regenerate types
with `supabase gen types typescript --local > lib/supabase/database.types.ts`
and commit the result.

Tables to create (SQL migration):
- profiles(id uuid pk = auth.users.id, display_name text, role text default 'player'
  check role in ('player','admin'), first_submitted_at timestamptz,
  created_at timestamptz default now())
- teams(id serial pk, name text, group_code text)
- matches(id serial pk, match_no int unique, group_code text, match_date date,
  home_team_id int references teams, away_team_id int references teams,
  home_goals int, away_goals int, status text default 'scheduled')
- match_predictions(id serial pk, user_id uuid references profiles, match_id int
  references matches, home_goals int, away_goals int, points int default 0,
  updated_at timestamptz default now(), unique(user_id, match_id))
- group_table_predictions(id serial pk, user_id uuid references profiles,
  group_code text, team_id int references teams, predicted_rank int,
  points int default 0, unique(user_id, group_code, team_id))
- actual_group_standings(group_code text, team_id int references teams,
  final_rank int, primary key(group_code, team_id))
- settings(id int pk default 1, lock_at timestamptz)

Row Level Security:
- Enable RLS on all tables.
- profiles: a user can read all profiles (needed for leaderboard names) but update
  only their own.
- teams, matches, settings, actual_group_standings: readable by all authenticated
  users; writable only by users whose profile.role = 'admin'.
- match_predictions & group_table_predictions: a user can read/insert/update/delete
  ONLY rows where user_id = auth.uid(). Add a `BEFORE INSERT OR UPDATE` trigger
  on BOTH tables that raises an exception when `now() >= (select lock_at from
  settings where id = 1)`. Example shape:

  ```sql
  create or replace function reject_writes_after_lock() returns trigger as $$
  begin
    if now() >= (select lock_at from settings where id = 1) then
      raise exception 'Predictions are locked' using errcode = 'P0001';
    end if;
    return new;
  end;
  $$ language plpgsql security definer;
  ```

- Add an auth trigger (`on auth.users insert`) that inserts a profiles row with
  the user's display name from `raw_user_meta_data->>'full_name'`. The trigger
  must also:
  - **Reject non-company emails.** If the email does not end with `@voice123.com`,
    raise an exception so the signup is rolled back.
  - **Bootstrap admins from a hardcoded allowlist** in the trigger body. Start
    the list with `nathalia@voice123.com` → role 'admin'. Anyone else gets
    role 'player'. To add a new admin later, edit the function and re-migrate.
    (Deliberately no env vars and no UI for this — it's an office tool, two
    or three admins ever.)

Seed data (from the spreadsheet — create /data/tournament.ts as the single source
of truth, then a seed script that inserts teams and the 72 matches):

Groups and teams (normalize names to English as shown):
A: Mexico, South Africa, South Korea, Czech Republic
B: Canada, Bosnia and Herzegovina, Qatar, Switzerland
C: Brazil, Morocco, Haiti, Scotland
D: USA, Paraguay, Australia, Turkey
E: Germany, Curaçao, Ivory Coast, Ecuador
F: Netherlands, Japan, Sweden, Tunisia
G: Belgium, Egypt, Iran, New Zealand
H: Spain, Cape Verde, Saudi Arabia, Uruguay
I: France, Senegal, Iraq, Norway
J: Argentina, Algeria, Austria, Jordan
K: Portugal, DR Congo, Uzbekistan, Colombia
L: England, Croatia, Ghana, Panama

The 72 matches (match_no, date, group, home vs away):
1  2026-06-11 A Mexico vs South Africa
2  2026-06-11 A South Korea vs Czech Republic
3  2026-06-18 A Czech Republic vs South Africa
4  2026-06-18 A Mexico vs South Korea
5  2026-06-24 A Czech Republic vs Mexico
6  2026-06-24 A South Africa vs South Korea
7  2026-06-12 B Canada vs Bosnia and Herzegovina
8  2026-06-13 B Qatar vs Switzerland
9  2026-06-18 B Switzerland vs Bosnia and Herzegovina
10 2026-06-18 B Canada vs Qatar
11 2026-06-24 B Switzerland vs Canada
12 2026-06-24 B Bosnia and Herzegovina vs Qatar
13 2026-06-13 C Brazil vs Morocco
14 2026-06-13 C Haiti vs Scotland
15 2026-06-19 C Scotland vs Morocco
16 2026-06-19 C Brazil vs Haiti
17 2026-06-24 C Scotland vs Brazil
18 2026-06-24 C Morocco vs Haiti
19 2026-06-12 D USA vs Paraguay
20 2026-06-13 D Australia vs Turkey
21 2026-06-19 D USA vs Australia
22 2026-06-19 D Turkey vs Paraguay
23 2026-06-25 D Turkey vs USA
24 2026-06-25 D Paraguay vs Australia
25 2026-06-14 E Germany vs Curaçao
26 2026-06-14 E Ivory Coast vs Ecuador
27 2026-06-20 E Germany vs Ivory Coast
28 2026-06-20 E Ecuador vs Curaçao
29 2026-06-25 E Ecuador vs Germany
30 2026-06-25 E Curaçao vs Ivory Coast
31 2026-06-14 F Netherlands vs Japan
32 2026-06-14 F Sweden vs Tunisia
33 2026-06-20 F Netherlands vs Sweden
34 2026-06-20 F Tunisia vs Japan
35 2026-06-25 F Japan vs Sweden
36 2026-06-25 F Tunisia vs Netherlands
37 2026-06-15 G Belgium vs Egypt
38 2026-06-15 G Iran vs New Zealand
39 2026-06-21 G Belgium vs Iran
40 2026-06-21 G New Zealand vs Egypt
41 2026-06-26 G Egypt vs Iran
42 2026-06-26 G New Zealand vs Belgium
43 2026-06-15 H Spain vs Cape Verde
44 2026-06-15 H Saudi Arabia vs Uruguay
45 2026-06-21 H Spain vs Saudi Arabia
46 2026-06-21 H Uruguay vs Cape Verde
47 2026-06-26 H Cape Verde vs Saudi Arabia
48 2026-06-26 H Uruguay vs Spain
49 2026-06-16 I France vs Senegal
50 2026-06-16 I Iraq vs Norway
51 2026-06-22 I France vs Iraq
52 2026-06-22 I Norway vs Senegal
53 2026-06-26 I Norway vs France
54 2026-06-26 I Senegal vs Iraq
55 2026-06-16 J Argentina vs Algeria
56 2026-06-16 J Austria vs Jordan
57 2026-06-22 J Argentina vs Austria
58 2026-06-22 J Jordan vs Algeria
59 2026-06-27 J Algeria vs Austria
60 2026-06-27 J Jordan vs Argentina
61 2026-06-17 K Portugal vs DR Congo
62 2026-06-17 K Uzbekistan vs Colombia
63 2026-06-23 K Portugal vs Uzbekistan
64 2026-06-23 K Colombia vs DR Congo
65 2026-06-27 K Colombia vs Portugal
66 2026-06-27 K DR Congo vs Uzbekistan
67 2026-06-17 L England vs Croatia
68 2026-06-17 L Ghana vs Panama
69 2026-06-23 L England vs Ghana
70 2026-06-23 L Panama vs Croatia
71 2026-06-27 L Panama vs England
72 2026-06-27 L Croatia vs Ghana

Also seed settings with one row (id=1) and a placeholder lock_at of
'2026-06-11 00:00:00Z' (admin can change later).

Acceptance criteria:
- `supabase db push` applies the migration cleanly on a fresh project.
- `supabase gen types typescript` writes a non-empty `database.types.ts`.
- All 48 teams and 72 matches are inserted with correct group, date, and fixtures.
- The auth trigger creates a profiles row, sets `role='admin'` for
  `nathalia@voice123.com`, and rejects non-`@voice123.com` signups.
- RLS verified: a normal user cannot read another user's predictions; the lock
  trigger rejects writes when `now() >= lock_at` with a clear error;
  non-admins cannot write matches/results.
```

---

### T3 — Google SSO auth + profile

```
Implement authentication for the app using Supabase Auth with Google OAuth.

Do:
1. Configure Google as an OAuth provider via Supabase (document the redirect URLs
   and required Google Cloud console steps in the README).
2. Build a sign-in page with a single, well-designed "Continue with Google" button
   (shadcn button + Google mark). Friendly one-line value prop above it.
   When calling `supabase.auth.signInWithOAuth`, pass
   `options: { queryParams: { hd: 'voice123.com' } }` so the Google account
   picker only shows company accounts. (The auth trigger from T2 is the
   server-side enforcement; this is the polite UX layer.)
3. Implement the OAuth callback route and session handling using @supabase/ssr so
   sessions work in server components and middleware. If the callback errors
   because the auth trigger rejected the email domain, show a clear message
   ("This game is only open to @voice123.com accounts") instead of a stack trace.
4. Add middleware that protects all app routes except the sign-in page; unauthenticated
   users are redirected to sign-in.
5. On first sign-in, ensure a profiles row exists (rely on the DB trigger from T2,
   but defensively upsert display_name from the Google profile).
6. Add a header user menu (avatar + display name) with a Sign out action and a link
   to edit display name.
7. Build a simple "Edit display name" dialog that updates profiles.display_name.

Acceptance criteria:
- A user can sign in with Google and is redirected into the app.
- A profile is created automatically with their name.
- Protected routes redirect to sign-in when logged out.
- Sign out works and clears the session.
```

---

### T4 — App shell, navigation & design system

```
Build the app shell, navigation, and the visual design system for the app.

Do:
1. Define the design language: pick a clean, sporty-but-professional palette using
   shadcn/Tailwind CSS variables (a primary accent, neutral surface scale, success
   for "scored"/"correct", muted for locked states). Support light and dark.
2. Build a responsive top navigation (and a mobile bottom tab bar or drawer) with
   links: Matches, Group Tables, Leaderboard, and (admin only) Results. Include the
   user menu from T3.
3. Create reusable presentational components and tokens that later tickets will use:
   - PageHeader (title + subtitle + optional action)
   - SectionCard
   - StatPill / score badge
   - EmptyState and a LoadingState (skeletons)
   - A "Locked" banner component (used after the deadline)
4. Build a polished landing/home dashboard for signed-in players showing: a welcome,
   the prediction deadline (countdown), how many of their predictions are complete
   vs total, and quick links to finish predicting and view the leaderboard.
5. Ensure the whole shell is mobile-first and accessible (focus states, aria labels,
   skip-to-content).

Acceptance criteria:
- Navigation works on mobile and desktop and reflects admin vs player role.
- The home dashboard renders real completion counts (can use placeholder data until
  T5/T6 wire in, but structure the components to accept real props).
- The design feels cohesive and intentional across light/dark.
```

---

### T5 — Group-stage match prediction screen

```
Build the screen where players predict the score of every group-stage match.

Context: 72 matches across 12 groups (A–L), each with a date and a home/away team.
Players enter predicted home and away goals. Predictions save per-user and are
editable until the deadline (locking is handled in T7 — here, assume editable).

Do:
1. Fetch all matches (with team names/flags) grouped by group, ordered by date then
   match_no. Use a server component for the initial load.
2. Render groups as tabs or accordions (A–L). Within each group, list matches as
   clean cards/rows: home team — [score input] : [score input] — away team, plus the
   date. Use country flags (emoji or a flag icon set) for delight.
3. Provide compact numeric steppers/inputs for goals (0–20), keyboard and touch
   friendly. Each match independently editable.
4. Load the current user's existing match_predictions and pre-fill inputs.
5. Save predictions to match_predictions (upsert on user_id+match_id). Prefer
   debounced autosave with a subtle "Saved" toast/indicator; show optimistic UI.
   On every save, also run an `update profiles set first_submitted_at = now()
   where id = auth.uid() and first_submitted_at is null` — this is the timestamp
   tie-break #3 needs. (Cheap no-op once it's been set.)
6. Show a progress indicator: "X / 72 predicted." Highlight unpredicted matches.
7. Handle empty, loading (skeletons), and error states gracefully.

Acceptance criteria:
- A player can enter and edit a predicted score for any of the 72 matches.
- Predictions persist across reloads and are private to the user (RLS).
- Progress count is accurate. Works smoothly on a phone.
```

---

### T6 — Group-table prediction screen

```
Build the screen where players predict the final finishing order (1st–4th) of each
of the 12 groups.

Do:
1. For each group A–L, show the 4 teams and let the player order them 1→4. Use
   drag-and-drop reordering (with a keyboard-accessible fallback: up/down buttons or
   a rank selector), since drag-only is bad for accessibility and mobile.
2. Load existing group_table_predictions and pre-fill the order. Default to the
   seeded group order if none exists.
3. Save to group_table_predictions (one row per team with predicted_rank 1..4;
   upsert on user_id+group_code+team_id). Debounced autosave with a "Saved"
   indicator. On every save, also run the same
   `update profiles set first_submitted_at = now() where id = auth.uid() and
   first_submitted_at is null` from T5 (factor it into a small helper).
4. Show per-group completion state and an overall "X / 12 groups ranked" indicator.
5. Empty/loading/error states; mobile-first.

Acceptance criteria:
- A player can set and change the finishing order of every group.
- Each team gets a unique rank 1–4 within its group (enforce no duplicate ranks).
- Predictions persist and are private to the user.
```

---

### T7 — Deadline locking

```
Implement the prediction deadline so predictions become read-only after a set time.

Do:
1. Read settings.lock_at. Treat now() >= lock_at as "locked."
2. When locked: the match prediction screen (T5) and group-table screen (T6) render
   in read-only mode — show the player's saved predictions clearly but disable all
   inputs/drag. Display the "Locked" banner (from T4) explaining the deadline passed.
3. Enforce locking server-side as well: reject any insert/update to
   match_predictions or group_table_predictions when locked (this should already be
   guarded by the RLS/trigger from T2 — verify and surface a friendly error if a
   write is attempted).
4. Show a live countdown to the deadline on the home dashboard and prediction
   screens while still open.
5. Admin can edit lock_at from the admin area (simple datetime control). Document
   the timezone handling (store UTC).

Acceptance criteria:
- Before lock_at: predictions are editable.
- After lock_at: predictions are visible but cannot be changed in the UI or via the
  API. Friendly messaging throughout.
```

---

### T8 — Admin: enter match results

```
Build the admin-only screen for entering real match results.

Do:
1. Gate the route to profile.role = 'admin' (redirect others). Hide the nav link for
   non-admins.
2. List all 72 matches grouped/filterable by group and by date, showing fixture and
   current status. For each, provide home/away goal inputs and a "mark finished"
   action that sets matches.home_goals, away_goals, and status='finished'.
3. Allow editing a previously entered result (corrections) and clearing it back to
   scheduled.
4. After saving a result, trigger a re-score (call the scoring routine from T9).
   Until T9 exists, stub a `recomputeScores()` call.
5. Provide an admin control to set/edit the prediction deadline (lock_at).
   Do NOT build a UI to set group standings manually — T9 derives them from
   results, which is the single intended path. (If a group ever ends with a
   tie deeper than goals scored, the admin can patch `actual_group_standings`
   directly in the Supabase dashboard. Not worth a UI.)
6. Clear success/error feedback; confirm destructive actions (clearing a result).

Acceptance criteria:
- Only admins can access the screen and write results (verified against RLS).
- Entering/editing/clearing a result works and persists.
- Saving a result invokes the re-score routine.
```

---

### T9 — Scoring engine

```
Implement the scoring engine as one pure, unit-tested module plus a recompute
routine that writes points back to predictions.

Scoring rules (authoritative):

A) Match predictions — for each match with an actual final score, compare to the
   player's predicted score:
   - Exact score (home and away both correct) => 5 points.
   - Else, correct outcome (both predicted and actual are the same of: home win /
     draw / away win) => 2 points.
   - Else => 0 points.
   (Exact and outcome are NOT additive; exact is a flat 5.)

B) Group-table predictions — for each group with known final standings, award
   5 points for each team the player placed in its correct final rank (1–4).

Implementation:
1. Create /lib/scoring/score.ts with PURE functions:
   - scoreMatch(predicted, actual): number
   - scoreGroupTable(predictedRanks, actualRanks): number
   - and a helper outcome(home, away): 'H' | 'D' | 'A'
   No DB access in this file.
2. Write unit tests covering: exact score, correct-outcome-wrong-score, wrong
   outcome, draws, missing prediction (0), and group-table partial/full matches.
3. Determine actual final group standings by derivation only — there is no
   admin UI for this. For each group, once all 6 of its matches are 'finished',
   compute the table using: points (3/1/0) → goal difference (GF − GA) →
   goals scored. Write the 4 rows to `actual_group_standings`. Skip head-to-head
   and further FIFA tie-breakers — they're vanishingly rare in 6-match groups
   and not worth the complexity. If a group ever ties beyond goals scored,
   the admin can patch the row in the Supabase dashboard before the next
   recompute. Document this in a one-line code comment so future-you knows
   it's intentional.
4. Create recomputeScores(): loads all results, predictions, and standings; computes
   points via the pure module; writes points back to match_predictions.points and
   group_table_predictions.points. Make it idempotent and safe to re-run.
5. Expose recompute as a server action / API route callable by T8 after a result
   is saved.

Acceptance criteria:
- Unit tests pass and cover the rule matrix above.
- Recompute is deterministic and idempotent; re-running yields identical points.
- Points written match the documented rules for a hand-checked sample.
```

---

### T10 — Leaderboard + personal breakdown

```
Build the leaderboard and the per-player points breakdown.

Do:
1. Leaderboard page: rank all players by total points (sum of match_predictions.points
   + group_table_predictions.points). Show rank, display name/avatar, total points,
   and number of exact-score hits. Highlight the current user's row. Use a clean
   shadcn table that collapses nicely on mobile (cards on small screens).
2. Tie-breaking (documented + implemented): total points desc, then exact-score
   hits desc (count of `match_predictions` rows where `points = 5` for that user),
   then earliest `profiles.first_submitted_at` asc. Build this in a single SQL
   view or query — don't do it in JS over fetched rows.
3. Make totals update when results change — recompute (T9) writes points, and the
   leaderboard reads current points (revalidate / refetch on load; real-time
   subscription is a nice-to-have).
4. Personal breakdown: clicking a player (at least the current user) opens a detail
   view listing each match — predicted vs actual vs points earned — and each group
   table with points. Make it skimmable and a little celebratory for big hits.
5. Empty state before any results exist ("No results yet — predictions locked in,
   may the best colleague win").

Acceptance criteria:
- Leaderboard ranks correctly with the documented tie-break.
- Current user's row is highlighted and their breakdown is accessible.
- Numbers reconcile exactly with the scoring engine.
```

---

### T11 — Design polish, responsive & accessibility pass

```
Do a final polish pass to make the app feel genuinely premium and fully accessible.

Do:
1. Visual polish: consistent spacing scale, typography hierarchy, hover/active/focus
   states, subtle motion (page/section transitions, score-save feedback, leaderboard
   rank changes). Refine the color system and dark mode. Add nice flag treatment and
   a celebratory touch for exact-score hits.
2. Responsive QA on phone, tablet, desktop for every screen (sign-in, dashboard,
   matches, group tables, leaderboard, admin). Fix any layout breakages; ensure all
   primary flows are comfortable one-handed on mobile.
3. Accessibility (WCAG 2.1 AA): verify color contrast, keyboard navigation through
   all interactive elements (including drag-and-drop fallbacks), visible focus,
   labelled inputs, 44px touch targets, aria-live for autosave/toasts, reduced-motion
   support.
4. Empty, loading (skeletons), error, and locked states reviewed for every screen.
5. Performance: lazy-load where sensible, ensure server components for read-heavy
   pages, check Lighthouse (aim 90+ on Performance and Accessibility).

Acceptance criteria:
- Lighthouse Accessibility and Performance >= 90 on key pages.
- No keyboard traps; full keyboard operation possible.
- The app looks and feels like a polished consumer product on all screen sizes.
```

---

## 9. Phase 2 backlog (deferred)

Captured now so nothing from the spreadsheet is lost; build after the MVP ships.

- **Knockout predictions & scoring:** Last 32, Last 16, Quarters, Semis, Third-place final, Final, and World Champion. Escalating points per correct country (5 / 5 / 8 / 10 / 15) with +5 exact-score bonuses where the sheet specifies, and last-32 exact-score bonus.
- **Best-third-place logic:** model the "8 of 12 best No. 3" qualification and the No. 3 knockout-assignment key (the `_Lookup` sheet's combinatorial table) to auto-populate the Last 32 bracket.
- **Six bonus questions** with their point values and penalties: topscorer (20 / −15), country with most group goals (10 / −15), country with least group goals (10 / −15), red-card player (10), own-goal player (10), and "who wins the office toto" (15 / −20, resolved after the final but before applying negative points).
- **Hedging:** the sheet notes that knockout cells are auto-populated but can be overridden — let players manually override their bracket picks independent of their group predictions.
- **Admin polish:** bulk result entry, audit log, CSV export, and a "recalculate all" button.
- **Nice-to-haves:** real-time leaderboard via Supabase subscriptions, email/Slack reminders before the deadline, and a head-to-head comparison between two players.

---

## 10. How to use this document

1. Spin up a Supabase project and a Google OAuth client first (T2/T3 reference them).
2. Send the **Shared context** block + **T1** to your coding LLM. Run it, commit.
3. Proceed ticket by ticket in dependency order, verifying each ticket's acceptance
   criteria before moving on. T5/T6 can be parallelized after T4; T8 can run alongside
   T5–T7.
4. After T9, hand-check a few predictions against the scoring rules in section 5 to
   confirm the engine before trusting the leaderboard.