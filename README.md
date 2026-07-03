# Hearth — the Family Operating System

An AI chief-of-staff for the household. Family members dump chaos in — a photo of
a school flyer, a voice note, a pasted email — and Hearth turns it into a
structured, shared family board: events, tasks with owners, grocery lists,
reminders. Nobody types tasks into it; that's why every previous family
organizer failed, and why this one is possible now.

See [PLAN.md](./PLAN.md) for the full product thesis and build plan.

## Stack

- **App:** Expo (React Native + TypeScript), React Navigation
- **Backend:** Supabase — Postgres + RLS, Auth (email OTP), Storage, Edge
  Functions, Realtime
- **AI:** Claude API (structured tool-use extraction) in
  `supabase/functions/extract`

## Getting started

1. **Create a Supabase project** and apply the migration:

   ```sh
   supabase link --project-ref YOUR-PROJECT-REF
   supabase db push          # applies supabase/migrations/0001_init.sql
   ```

2. **Configure the app:**

   ```sh
   cp .env.example .env      # fill in your Supabase URL + anon key
   npm install
   ```

3. **Run it:**

   ```sh
   npx expo start            # scan the QR code with Expo Go
   ```

4. **(Phase 2) Deploy the extraction pipeline:**

   ```sh
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase functions deploy extract
   ```

   Then create a Database Webhook: `captures` table → INSERT → the `extract`
   function.

## Project layout

```
App.tsx                      app root: auth → family setup → board
src/
  context/AppState.tsx       session + family + members state
  lib/supabase.ts            Supabase client
  screens/                   Auth, FamilySetup, Board, AddItem, Capture
  navigation.ts, theme.ts, types.ts
supabase/
  migrations/0001_init.sql   schema, RLS, RPCs, realtime, storage bucket
  functions/extract/         Claude extraction pipeline (captures → proposals)
```

## Status

Phase 1 (foundation) scaffolded: auth, family create/join via invite code,
live shared board with manual add/complete, text capture inbox. Next:
proposal review cards, photo/voice ingestion, reminders and the morning digest.
