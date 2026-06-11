# Office World Cup Prediction Game — Build Plan

A complete product spec, ticket breakdown, and copy-paste LLM prompts to turn the
"Office World Cup Pool" spreadsheet into a simple, beautifully designed web app.

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase (Postgres + Auth) · Google SSO · deployed on Vercel.

**MVP scope (this plan):** group-stage match predictions + group-table predictions, automated group-stage scoring, and a live leaderboard. Knockout rounds and the six bonus questions are intentionally deferred to a Phase 2 backlog (listed at the end) so the first version ships fast.

---

## 1. Product story

### The problem
Every tournament the office runs a prediction pool in a shared Google Sheet. It works, but it's fragile: people overwrite each other's cells, the scoring formulas are opaque, mistakes are easy to make, and there's no satisfying "leaderboard moment." We want the same game, made effortless to play and genuinely nice to look at.

### The vision
A single web app where colleagues sign in with their work Google account, fill in their predictions before the tournament locks, and watch a live leaderboard update as real results come in. One admin enters the actual scores; everything else is automatic.

### Who uses it
- **Players** — colleagues who predict match outcomes and final group tables, then track their rank.
- **Admin** — one or two organizers who enter real match results and manage the prediction deadline.

### The core loop
1. Player signs in with Google.
2. Before the deadline, player predicts the score of every group-stage match and the final standing order of each group.
3. Deadline locks all predictions.
4. As matches finish, the admin enters real results.
5. The app scores every prediction automatically and updates the leaderboard in real time.

### Success looks like
- Everyone can fill in their full predictions on a phone in one sitting without confusion.
- Nobody can accidentally edit someone else's entry.
- The leaderboard is something people actually want to check.
- The organizer never touches a formula again.

---

## 2. User stories

**Authentication**
- As a player, I can sign in with my company Google account so I don't manage another password.
- As a player, I stay signed in across visits so I can return to update my predictions until the deadline.

**Predictions — group matches**
- As a player, I can see all 72 group-stage matches grouped by group (A–L) and by date.
- As a player, I can enter a predicted score (home and away goals) for each match.
- As a player, my predictions save automatically (or with a clear Save action) and I can come back and edit them until the deadline.
- As a player, I can see at a glance how many of my predictions are still empty.

**Predictions — group tables**
- As a player, for each group I can predict the final finishing order of the 4 teams (1st → 4th).
- As a player, this is easy to do on mobile (drag-to-reorder or simple ranking controls).

**Deadline & locking**
- As a player, once the deadline passes I can still view my predictions but no longer edit them.
- As an admin, I can set/change the deadline.

**Admin — results**
- As an admin, I can enter the real final score of each group-stage match.
- As an admin, entering a result triggers automatic re-scoring.

**Scoring & leaderboard**
- As a player, I can see a leaderboard ranked by total points, with my row highlighted.
- As a player, I can click into my own card to see a per-prediction breakdown of how points were earned.
- As a player, I can trust the points match the documented scoring rules.

---

## 3. Functional requirements

1. Google OAuth sign-in via Supabase Auth; first sign-in auto-creates a player profile (display name from Google, editable).
2. A role flag distinguishes `admin` from `player`.
3. Players submit two prediction types: **match score predictions** (per match) and **group-table predictions** (ordered ranking per group).
4. Predictions are editable until a global **lock datetime**; read-only afterward.
5. Admin can enter/edit **actual match results** and the **actual final group standings** (the latter can be derived automatically from results — see scoring notes).
6. A **scoring engine** computes points deterministically from results + predictions, per the rules in section 5.
7. A **leaderboard** ranks players by total points (with documented tie-breaking) and updates when results change.
8. A **per-player breakdown** view shows points earned per match and per group table.
9. Mobile-first responsive design; all flows usable on a phone.

## 4. Non-functional requirements

- **Design quality is a first-class requirement.** Clean, modern, confident. shadcn/ui components, a coherent color system, generous spacing, smooth empty/loading/locked states. It should feel like a polished product, not an internal tool.
- **Accessibility:** WCAG 2.1 AA — keyboard navigable, sufficient contrast, labelled inputs, 44px touch targets.
- **Performance:** fast first load; server components for read-heavy pages (matches, leaderboard).
- **Security:** Supabase Row Level Security so a player can only read/write their own predictions; results and deadline writable only by admins; predictions rejected server-side after lock.
- **Maintainability:** typed end-to-end (TypeScript), tournament data seeded from a single source file so a future tournament is a re-seed.
- **Single source of truth for scoring:** one pure, unit-tested scoring module reused by the engine.
- **Operational simplicity (this is an office tool — keep it boring):**
  - Migrations are managed with the **Supabase CLI** (`supabase/migrations/*.sql`). One local Supabase project, one hosted project, one CI-free flow: run migrations from the CLI, generate TS types with `supabase gen types typescript`.
  - **Sign-in is restricted to the company Google Workspace domain** (`voice123.com`). Pass `hd: 'voice123.com'` to `signInWithOAuth`, and have the auth trigger reject other domains as a defense in depth.
  - **First admin is bootstrapped in the auth trigger** via a small hardcoded email allowlist in the migration (start with `nathalia@voice123.com`). No env vars, no UI to grant admin — edit the SQL and re-migrate to add another admin.

---

## 5. Scoring specification (from the spreadsheet)

This is the authoritative scoring spec for the MVP. It mirrors the sheet's "How do you receive points?" rules for the parts in scope.

### Group-stage match predictions
For each of the 72 group matches, compare the predicted score to the actual final score (after 90 minutes of play, per the sheet):

- **Exact score correct → 5 points.** (e.g. predicted 2–1, actual 2–1)
- **Correct outcome only (Win / Draw / Loss) but wrong score → 2 points.**
- **Wrong outcome → 0 points.**

Exact and outcome are not additive: a correct exact score is worth 5 total, not 5 + 2.

### Group-table predictions
For each group, compare the player's predicted finishing order against the actual final standings:

- **5 points per team predicted in its correct final position** (correct team in the correct rank 1–4).

> Note: the sheet phrases this as "5 points per correct country in group stage table." Implement it as per-position correctness (team X finished where I said it would). Confirm with the organizer if they instead intend "correct set of qualifiers" — keep the rule isolated in the scoring module so this is a one-line change.

### Tie-breaking on the leaderboard
The spreadsheet does not define a player tie-break. Recommended order, documented and configurable:
1. Total points (desc)
2. Number of exact-score hits (desc) — derived: `match_predictions` rows where `points = 5`
3. Earliest first-submission timestamp (asc) — see `profiles.first_submitted_at` in the schema; set once, when a player saves their first prediction of any kind, then never overwritten.

### A note on group standings tie-breaking
The "actual group standings" derivation uses a simplified FIFA tie-break: **points → goal difference → goals scored**. We intentionally skip head-to-head, fair play, and the drawing of lots — they're vanishingly rare in 6-match groups and not worth the complexity for an office pool. If a group really does end tied beyond goals scored, the admin can correct the standings manually before scoring runs.

### Out of scope for MVP (Phase 2)
Knockout-round points (last 32 / 16 / 8 / 4 / 2 with escalating values and exact-score bonuses), best-third-place logic, and the six bonus questions (topscorer, most/least goals country, red card, own goal, office toto winner, including their negative-point penalties). These are captured in the Phase 2 backlog.

---

## 6. Data model (target Supabase schema)

```
profiles
  id                  uuid (pk, = auth.users.id)
  display_name        text
  role                text  default 'player'   -- 'player' | 'admin'
  first_submitted_at  timestamptz                -- set once on first prediction save (tie-break #3)
  created_at          timestamptz

teams
  id            serial (pk)
  name          text   -- normalized English name
  group_code    text   -- 'A'..'L'

matches
  id            serial (pk)
  match_no      int    -- 1..72 (from the sheet)
  group_code    text
  match_date    date
  home_team_id  int -> teams.id
  away_team_id  int -> teams.id
  home_goals    int  null   -- actual result, admin-entered
  away_goals    int  null
  status        text default 'scheduled'  -- 'scheduled' | 'finished'

match_predictions
  id            serial (pk)
  user_id       uuid -> profiles.id
  match_id      int  -> matches.id
  home_goals    int
  away_goals    int
  points        int  default 0   -- computed
  updated_at    timestamptz
  unique(user_id, match_id)

group_table_predictions
  id            serial (pk)
  user_id       uuid -> profiles.id
  group_code    text
  team_id       int  -> teams.id
  predicted_rank int  -- 1..4
  points        int  default 0   -- computed
  unique(user_id, group_code, team_id)

actual_group_standings        -- derived from results, or admin-set
  group_code    text
  team_id       int -> teams.id
  final_rank    int  -- 1..4
  primary key (group_code, team_id)

settings
  id            int pk default 1
  lock_at       timestamptz   -- prediction deadline
```

**Tournament seed data** (12 groups, 48 teams, 72 matches with dates) comes straight from the spreadsheet's "Group Stage" tab. Normalize the Dutch team names to English during seeding: Tsjechië→Czech Republic, Bosnië-Herzegovina→Bosnia and Herzegovina, Turkije→Turkey, Zweden→Sweden, Curaçao→Curaçao, Irak→Iraq.

---

## 7. Ticket breakdown & dependencies

| # | Ticket | Depends on |
|---|--------|-----------|
| T1 | Project scaffold (Next.js + Tailwind + shadcn + Supabase client) | — |
| T2 | Database schema, RLS policies & tournament seed | T1 |
| T3 | Google SSO auth + profile creation | T1, T2 |
| T4 | App shell, navigation & design system | T1 |
| T5 | Group-stage match prediction screen | T2, T3, T4 |
| T6 | Group-table prediction screen | T2, T3, T4 |
| T7 | Deadline locking (read-only after lock) | T5, T6 |
| T8 | Admin: enter match results | T2, T3 |
| T9 | Scoring engine (pure module + recompute) | T2, T8 |
| T10 | Leaderboard + personal breakdown | T9 |
| T11 | Design polish, responsive & accessibility pass | T5–T10 |

Work them roughly in order. T5/T6 can run in parallel after T4; T8 can run in parallel with T5–T7.

---

## 8. Build prompts (one per ticket)

Each prompt is self-contained and copy-paste ready. Send them to your coding LLM **in order**. Paste the same shared context block (below) at the top of each prompt so the model always knows the stack and conventions — or, if you keep one long-lived session, paste the context once and then send tickets sequentially.

### Shared context (prepend to each ticket)

```
PROJECT: "Office World Cup Prediction Game" — a web app where colleagues predict
2026 World Cup group-stage results and compete on a leaderboard.

STACK (do not deviate):
- Next.js (latest, App Router) + TypeScript
- Tailwind CSS + shadcn/ui for all UI components
- Supabase for Postgres database and Auth (Google OAuth)
- Deployed on Vercel

CONVENTIONS:
- Mobile-first, responsive. Design quality matters: clean, modern, confident,
  generous spacing, thoughtful empty/loading/locked states. Aim for "polished
  product," not "internal tool."
- Use server components for read-heavy pages; client components only where needed.
- All data access goes through a typed Supabase client. Enforce security with
  Row Level Security, not just UI checks.
- Keep scoring logic in ONE pure, unit-tested TypeScript module.
- WCAG 2.1 AA: labelled inputs, keyboard navigable, 44px touch targets, good contrast.

SCOPE OF THE OVERALL MVP: group-stage match score predictions + group-table
(finishing order) predictions, a prediction deadline lock, admin entry of real
results, automated scoring, and a leaderboard. Knockout rounds and bonus
questions are OUT of scope for now.
```

---

