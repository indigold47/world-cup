# Things you need to do (outside the code)

A running checklist of the manual / external steps required to actually run
and ship the app. Tick items off as you finish them.

Everything here is one-time setup (or rare maintenance). Day-to-day code
changes don't need any of this.

---

## 1. Create the Supabase project

- [ ] Sign in at <https://supabase.com/dashboard> with your work Google account.
- [ ] Create a new project. Pick the closest region. Save the database password
      somewhere safe — you won't need it day-to-day, but you'll be glad to
      have it.
- [ ] From **Settings → API Keys** (or **Settings → API** in older dashboards),
      copy:
      - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
      - **`anon` / `publishable` key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
      - **`service_role` / `secret` key** → `SUPABASE_SERVICE_ROLE_KEY`
        (click "Reveal" to see it — looks like `eyJ...` or `sb_secret_...`)

> **Naming note:** Supabase recently renamed their keys. `publishable` =
> `anon` and `secret` = `service_role` — same role, new names. The code
> accepts either format.
>
> **You don't strictly need `service_role` right now.** No code path in this
> app uses it; every Supabase call goes through the user's session. Set it if
> you want, or leave it blank. The two `NEXT_PUBLIC_*` values are the only
> ones the app actually reads.

---

## 2. Configure Google OAuth

This is what enables "Continue with Google" and restricts sign-in to
@voice123.com accounts.

### 2a. Google Cloud Console

- [ ] Go to <https://console.cloud.google.com> → create a new project (or
      reuse an existing one if you have permission).
- [ ] **APIs & Services → OAuth consent screen**
      - **User type: Internal** (Voice123 Workspace) — this alone restricts
        sign-in to @voice123.com. **Do NOT publish or verify** the consent
        screen; "Internal" is what makes the domain restriction work.
      - App name: `Office World Cup Pool`
      - Support email: your work address.
- [ ] **APIs & Services → Credentials → Create credentials → OAuth client ID**
      - Application type: **Web application**
      - Authorized JavaScript origins:
        - `http://localhost:3000`
        - `https://<your-vercel-domain>` (add once you deploy)
      - Authorized redirect URIs (see 2b below for how to find this):
        - `https://<your-supabase-ref>.supabase.co/auth/v1/callback`
      - After saving, Google shows you the **Client ID** but the **Client
        Secret is on the next screen** — click **Download JSON** to grab both
        in one file, or click into the client from the Credentials list to
        reveal the secret with a copy button.

> If you see a yellow notice that says "OAuth access is restricted to users
> within your organization unless the OAuth consent screen is published and
> verified" — that's the **Internal** user type doing exactly what we want.
> Leave it alone. No verification needed.

### 2b. Where to find the Supabase redirect URI

Three equivalent ways:

1. **Easiest:** Supabase → **Authentication → Sign In / Providers → Google**
   (toggle Google on first). The page itself shows a **Callback URL (for
   OAuth)** field with a copy button — that's exactly the URL Google wants.
2. **Construct it:** take your `NEXT_PUBLIC_SUPABASE_URL` and append
   `/auth/v1/callback`. E.g. `https://abcxyz123.supabase.co/auth/v1/callback`.
3. **Look it up:** Supabase → Settings → General → **Reference ID** is your
   project ref; plug it into the template.

No trailing slash. No `http://`. Google is strict about the match.

### 2c. Wire up Supabase

- [ ] Supabase → **Authentication → Sign In / Providers → Google**:
      - Toggle Google **on**.
      - Paste **Client ID** (ends in `.apps.googleusercontent.com`).
      - Paste **Client Secret** (from the JSON or the Credentials page).
      - Save.
- [ ] Supabase → **Authentication → URL Configuration**:
      - **Site URL**: `https://<your-vercel-domain>` (use
        `http://localhost:3000` while you only have local dev).
      - **Redirect URLs** (additional):
        `http://localhost:3000/**`,
        `https://<your-vercel-domain>/**`,
        and the Vercel preview pattern `https://<project>-*.vercel.app/**`.

---

## 3. Apply the database migrations

There are three migration files under `supabase/migrations/`. `db push`
applies them all in one go.

- [ ] Install the Supabase CLI locally if you haven't:
      `brew install supabase/tap/supabase`
      (or rely on the dev-dep already installed and run `npx supabase ...`).
- [ ] Link this repo to the hosted project (one-time):
      ```bash
      npx supabase login
      npx supabase link --project-ref <your-project-ref>
      ```
- [ ] Push all migrations:
      ```bash
      npx supabase db push
      ```
      You'll see three migrations apply: initial schema + seed (T2),
      `recompute_scores()` function (T9), `get_leaderboard()` function (T10).
- [ ] Regenerate TS types so the codebase stops using the hand-written shim:
      ```bash
      npx supabase gen types typescript --linked > lib/supabase/database.types.ts
      ```
      Commit the result.

---

## 4. Local development env file

- [ ] `cp .env.example .env.local`
- [ ] Paste the values from step 1 into `.env.local`. Minimum required:
      ```
      NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
      NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable / anon key>
      ```
      (The `SUPABASE_SERVICE_ROLE_KEY` line can stay empty — no code reads
      it today.)
- [ ] `npm run dev` → open <http://localhost:3000> → click **"Continue with
      Google"** → pick your @voice123.com account → you should land back on
      the home dashboard with your name in the header.

If the redirect fails with "redirect URI mismatch", the URL in the Google
client doesn't byte-for-byte match what Supabase sends. Recheck step 2b.

---

## 5. First admin

The auth trigger automatically promotes `nathalia@voice123.com` to admin on
first sign-in. **Nothing to do here unless you want more admins.**

To add another admin later:

- [ ] Either edit the email allowlist in
      `supabase/migrations/<timestamp>_initial_schema.sql`, inside the
      `handle_new_user()` function (the `v_admin_emails` array), then add a
      *new* migration via `npx supabase migration new add_admin_<name>` and
      `npx supabase db push`.
- [ ] OR, for a one-off, just update `profiles.role` to `'admin'` directly in
      the Supabase dashboard's table editor for that user's row.

---

## 6. Deploy to Vercel

- [ ] Push the repo to GitHub.
- [ ] On <https://vercel.com/new>, import the repo. Vercel auto-detects
      Next.js — no build config needed.
- [ ] In the Vercel project's **Settings → Environment Variables**, add the
      two `NEXT_PUBLIC_*` values from step 1 (Production + Preview). Add the
      service-role key too if you ever extend the app to need it.
- [ ] Trigger a deploy. Once it's live, copy the production URL and:
      - Add it to Google OAuth **Authorized JavaScript origins** (step 2a).
      - Add it to Supabase **URL Configuration → Site URL + Redirect URLs**
        (step 2c).

---

## 7. Set the prediction deadline

- [ ] In Supabase **Table Editor → settings**, update `lock_at` to the actual
      kickoff time of the first match (stored in UTC). Default seeded value
      is `2026-06-11 00:00:00Z`.
- [ ] Or set it in-app: sign in as the admin, go to **/results**, and use the
      **Prediction deadline** card. The datetime input uses your local
      timezone; the server stores UTC.
- [ ] After `lock_at` passes, all predictions become read-only automatically
      (enforced by the DB trigger; the UI shows the locked banner and the
      countdown switches to "Locked").

---

## 8. Day-of operations

When matches finish, the admin enters the actual scores in the **Results**
tab. Saving a result automatically runs `recompute_scores()` and the
leaderboard updates everywhere.

You can enter results whenever — there's no time pressure. The scoring
engine is deterministic and idempotent, so the order you enter them in
doesn't change the final point totals.

If a group ends with teams perfectly tied beyond goals scored (rare in
6-match groups), open the Supabase dashboard and edit the
`actual_group_standings` rows for that group manually before the next match
result is entered — the engine will pick them up on the next recompute.

---

## Future / Phase 2

Anything in `_docs/claude.md` §9 (knockouts, bonus questions, real-time
leaderboard, Slack reminders, etc.) ships only after the MVP is live and
people have actually used it.
