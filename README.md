# Hearth — the Family Operating System

**Live app:** https://aniketson02.github.io/New-soft/ (auto-deployed from this
branch by GitHub Actions)

An AI chief-of-staff for the household. Family members dump chaos in — a photo of
a school flyer, a voice note, a pasted email — and Hearth turns it into a
structured, shared family board: events, tasks with owners, grocery lists,
reminders. Nobody types tasks into it; that's why every previous family
organizer failed, and why this one is possible now.

See [PLAN.md](./PLAN.md) for the full product thesis and build plan.

## Status: fully live — backend, app, and AI

The Supabase backend is **provisioned and live** (project `hearth`,
`tdmdxvnbrhdijxmefotu`, free tier): schema + RLS applied, realtime enabled,
storage bucket ready, and the `extract` edge function deployed. The app is
pre-configured to use it (`src/lib/config.ts`) — clone, install, run.

**AI extraction is switched on**, currently powered by Gemini
(`gemini-2.5-flash`) with the API key stored in Supabase Vault and readable
only by `service_role` (see `supabase/migrations/0003_llm_key_vault_accessor.sql`).
Verified end-to-end: a pasted family note produced correctly typed proposals
with resolved dates, recurrence rules, owners, and grocery-list routing.

To switch to Claude later, set the Anthropic key — it takes precedence:

```sh
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref tdmdxvnbrhdijxmefotu
```

## Run it

```sh
npm install
npx expo start        # scan the QR code with Expo Go on your phone
```

Sign in with your email (6-digit code), create your family, share the invite
code, and start capturing.

## What works today

- **Email OTP sign-in**, create a family or join with an invite code
- **Shared family board** — Today / This week / Later, owner avatars, overdue
  highlighting, live-sync between family members (Supabase Realtime)
- **Capture** — paste/type text or snap a photo of a flyer; the extract
  pipeline turns it into structured proposals (Claude tool-use, text + vision)
- **Review cards** — AI suggestions land as one-tap accept/edit/dismiss cards
  (nothing is silently auto-committed)
- **Lists** — grocery/list entries with check-off, auto-created from captures
- Board banner when suggestions are waiting; pull-to-refresh everywhere

## Stack

- **App:** Expo (React Native + TypeScript), React Navigation
- **Backend:** Supabase — Postgres + RLS, Auth (email OTP), Storage, Edge
  Functions, Realtime
- **AI:** Claude API (structured tool-use extraction, text + vision) in
  `supabase/functions/extract`

## Web deployment

Every push to this branch (or `main`) runs
`.github/workflows/deploy-web.yml`, which builds the Expo web export and
publishes it to **GitHub Pages** at https://aniketson02.github.io/New-soft/.

Vercel was the first choice but is unreachable from this development
environment (egress policy + no CLI credentials); `vercel.json` is kept so
`vercel deploy` works from any machine if you prefer Vercel later. Note:
Supabase edge functions cannot host the page — the platform rewrites HTML
responses to `text/plain` with a sandbox CSP, so the `web` function simply
redirects to the GitHub Pages URL.

## Project layout

```
App.tsx                      app root: auth → family setup → board stack
src/
  context/AppState.tsx       session + family + members state
  lib/supabase.ts            Supabase client (env override → config.ts default)
  lib/acceptProposal.ts      proposal → confirmed board item
  components/Avatar.tsx      deterministic member avatars
  screens/                   Auth, FamilySetup, Board, AddItem, Capture,
                             Review, Lists
supabase/
  migrations/                0001 schema · 0002 security hardening
  functions/extract/         Claude extraction pipeline (captures → proposals)
```

## Rebuilding the backend from scratch

```sh
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
supabase functions deploy extract
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Then point `.env` (see `.env.example`) or `src/lib/config.ts` at your project.

## Next (v0.2)

Voice-note capture, push reminders + morning digest, share-sheet ingestion,
calendar two-way sync, proactive planning ("Mia has soccer and a dentist visit
Thursday — who's driving?").
