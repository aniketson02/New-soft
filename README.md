# Hearth — the Family Operating System

An AI chief-of-staff for the household. Family members dump chaos in — a photo of
a school flyer, a voice note, a pasted email — and Hearth turns it into a
structured, shared family board: events, tasks with owners, grocery lists,
reminders. Nobody types tasks into it; that's why every previous family
organizer failed, and why this one is possible now.

See [PLAN.md](./PLAN.md) for the full product thesis and build plan.

## Status: live backend, working app

The Supabase backend is **provisioned and live** (project `hearth`,
`tdmdxvnbrhdijxmefotu`, free tier): schema + RLS applied, realtime enabled,
storage bucket ready, and the `extract` edge function deployed. The app is
pre-configured to use it (`src/lib/config.ts`) — clone, install, run.

**One step remains to switch on the AI** (needs your Anthropic API key):

```sh
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref tdmdxvnbrhdijxmefotu
```

Until then, captures are stored and the app shows a friendly "AI is not
configured yet" note on each capture (verified end-to-end).

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

## Web build

`npx expo export --platform web` produces a static site in `dist/`;
`vercel.json` is included, so `vercel deploy` ships it as-is. (Not deployed
autonomously — publishing publicly is your call.)

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
