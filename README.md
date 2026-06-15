# Hoang Lab World Cup

A World Cup prediction pool for a lab group.

## What is included

- Simple local sign-in plus a Google sign-in placeholder.
- World Cup match list with kickoff locking.
- Users can save predictions only before kickoff.
- Other people's predictions stay hidden until the match starts.
- Finished matches reveal predictions and calculate points automatically.
- Scoring rules:
  - 10 points: exact score.
  - 7 points: correct winner or draw plus one correct team score.
  - 5 points: correct winner or draw only.
  - 2 points: one correct team score only.
  - 0 points: wrong or missing prediction.

## Run locally

```bash
pnpm install
pnpm dev
```

In this Codex workspace, the app is running at:

```text
http://127.0.0.1:5173
```

## Make it a real shared website

The app now supports two modes:

- Local demo mode: no environment variables needed.
- Supabase guest mode: shared matches, predictions, and leaderboard with name/email entry only.

### 1. Create Supabase

1. Create a project at https://supabase.com.
2. Open SQL Editor.
3. Paste and run `supabase/schema.sql`.
4. Paste and run `supabase/guest-mode.sql`.
5. No Supabase login provider is required for the casual guest flow.

### 2. Add environment variables

Copy `.env.example` to `.env.local` and fill:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Restart the dev server after changing env vars. Users will enter name/email only; no email verification or password is required.

### 3. Deploy to Vercel

1. Push this folder to GitHub.
2. Import the repo at https://vercel.com.
3. Add the same environment variables in Vercel project settings.
4. Deploy.
5. In Supabase Authentication > URL Configuration, add the Vercel URL as an allowed redirect URL.

## FIFA match data

The app uses `src/fifa.ts` as the match sync adapter. By default it loads local seed data from `src/data.ts`.

To connect a FIFA-derived match feed, set:

```bash
VITE_FIFA_MATCHES_URL=https://your-match-feed.example.com/world-cup-2026.json
```

The adapter accepts either an array of matches or an object with `matches` / `Results`. For production, the safest path is to run a small server-side scheduled sync that reads from the official FIFA match source, normalizes the data, and serves your app a stable JSON format.

## Score sync

Supabase Edge Function scaffold:

```text
supabase/functions/sync-scores/index.ts
```

It expects:

```bash
MATCH_FEED_URL=https://your-match-feed.example.com/world-cup-2026.json
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Deploy it with the Supabase CLI, then schedule it to run during match days. The function upserts rows into `matches`, and the app recalculates points automatically from finished scores.

## Production path

Use Firebase or Supabase for:

- Email/password authentication.
- Lab-only access by email domain or invite list.
- Predictions table with a unique `(userId, matchId)` rule.
- Server-side locking at kickoff so nobody can bypass the UI.
- Scheduled match/result sync.
- Server-side point calculation after final scores arrive.
