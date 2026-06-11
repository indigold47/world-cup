# Voice123 World Cup Prediction Game

A small, polished web app where colleagues sign in with their work Google
account, predict every group-stage match of the 2026 FIFA World Cup, and
compete on a live leaderboard. Built for one company, so it stays simple.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui ·
Supabase (Postgres + Auth + Google SSO) · deployed on Vercel.

> See `_docs/claude.md` for the full product spec and `_docs/prompts.md` for
> the ticket-by-ticket build plan.

## Local setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a Supabase project**

   At <https://supabase.com/dashboard>. From the project's
   **Settings → API** page, copy the URL, the `anon` key, and the
   `service_role` key.

3. **Configure env vars**

   ```bash
   cp .env.example .env.local
   ```

   Fill in the three values. `.env.local` is gitignored.

4. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000>.

## Database migrations (Supabase CLI)

Migrations live in `supabase/migrations/`. The schema, RLS policies, and the
tournament seed are introduced in T2.

```bash
# Link this folder to the hosted Supabase project (one-time)
npx supabase login
npx supabase link --project-ref <your-project-ref>

# Apply pending migrations to the hosted project
npx supabase db push

# Regenerate TypeScript types after a migration
npx supabase gen types typescript --linked > lib/supabase/database.types.ts
```

## Tests

```bash
npm test          # Vitest, one-shot
npm test -- --watch
```

The scoring engine (T9) lives in `lib/scoring/` with its tests alongside.

## Deploying to Vercel

1. Push the repo to GitHub.
2. Import it on <https://vercel.com/new>. Vercel auto-detects Next.js — no
   custom build config needed.
3. Paste the three env vars from `.env.local` into the Vercel project's
   **Settings → Environment Variables** (Production + Preview).
4. Add the Vercel deployment URL to Supabase **Auth → URL Configuration** as
   an allowed redirect URL (T3 documents this in detail).

That's the whole deploy story. There is no `vercel.json`.

## Folder structure

```
app/                  Next.js App Router pages and layouts
components/ui/        shadcn/ui primitives
lib/
  supabase/           Browser + server Supabase client helpers, generated types
  scoring/            Pure scoring functions and tests (T9)
  utils.ts            shadcn cn() helper
data/                 Tournament seed (added in T2)
supabase/migrations/  SQL migrations managed by the Supabase CLI
_docs/                Project plan: claude.md (spec) + prompts.md (tickets)
```
