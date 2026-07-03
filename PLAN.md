# The Idea + App Building Plan

## Context

You asked me to skip the long memo process, pick the strongest startup idea directly, and give you the app building plan. I worked through the candidate space (life-admin agents, eldercare coordination, social planning, meal/grocery loops, personal memory, money micro-decisions) and killed each for being either a graveyard category, too narrow, an existing company, or infeasible as a first product. One survived.

## The Idea: **Hearth — the Family Operating System**

**One-liner:** An AI chief-of-staff for the household. Every family runs on an invisible, unpaid project manager (usually one exhausted person) who tracks school emails, appointments, groceries, bills, chores, and everyone's schedules in their head. Hearth ingests the chaos — forwarded emails, screenshots, voice dumps, photos of paper notices — and autonomously maintains the family's shared calendar, task board, lists, and plans. Nobody types tasks into it; that's why every prior "family organizer" (Cozi et al.) failed.

**Why this one:**
- **Severity + universality:** the "mental load" problem exists in essentially every household on Earth, every day.
- **Why now:** only current LLMs can turn a photographed school flyer or a rambling voice note into structured events, tasks, and assignments with dates, owners, and reminders. Manual entry was the fatal flaw of every predecessor — AI removes it. This is AI-essential, not decorative.
- **Built-in virality + network effects:** the product only works when the whole family joins; every signup invites 2–5 more. The family graph and accumulated household context (routines, preferences, recurring events) are the moat — switching cost grows daily.
- **Daily habit:** meals, schedules, and chores recur daily by nature.
- **Rejected alternatives (short list):** life-admin execution agent (agentic calling/forms too heavy for MVP), eldercare coordination (strong, but a subset of this — Hearth covers it), social planning (graveyard), personal memory (Rewind exists, privacy wall).

## MVP Scope (v0.1 — "the magic loop")

One loop, done perfectly: **dump chaos in → structured family plan comes out → whole family sees it.**

1. **Family space:** create family, invite via link, member profiles (adults/kids).
2. **Ingestion:** share-sheet / in-app capture of (a) photos & screenshots (school flyers, notices), (b) voice notes, (c) pasted text/forwarded email. Claude extracts events, tasks, deadlines, lists — with owner suggestions.
3. **The Board:** unified family view — Today / This Week: calendar items, tasks with owners, shared lists (groceries auto-built from mentions).
4. **Review step:** AI proposals land as cards the user confirms/edits in one tap (trust-building; nothing silently auto-committed).
5. **Reminders & digest:** push notifications per owner; a 7 a.m. "here's your family's day" digest.

Explicitly **not** in MVP: calendar two-way sync, email inbox connection, meal planning, chore gamification, agentic actions. Those are v0.2+.

## Tech Stack

- **Mobile app:** Expo (React Native + TypeScript) — one codebase, iOS + Android, share-sheet extension support.
- **Backend:** Supabase — Postgres (families, members, items), Auth (magic-link + invite links), Storage (captured images/audio), Edge Functions for the AI pipeline, Realtime for live board sync. (Supabase is already connected to this session.)
- **AI:** Claude API (`claude-sonnet-5` for extraction; structured tool-use output → typed `items` rows). Voice notes transcribed then extracted.
- **Push:** Expo Notifications.

## Architecture (high level)

```
Expo app ── capture (photo/voice/text) ──► Supabase Storage + `captures` row
                                              │ (DB webhook)
                                              ▼
                                   Edge Function: extraction pipeline
                                   (Claude → structured events/tasks/lists)
                                              │
                                              ▼
                              `proposals` rows ──► app review cards ──► confirmed `items`
                                              │
                                              ▼
                              Realtime board sync + scheduled digest/reminder function
```

Data model core: `families`, `members`, `captures`, `proposals`, `items` (type: event|task|list_entry, owner, due, recurrence), `lists`.

## Build Phases

- **Phase 1 — Foundation (repo scaffold):** Expo app + Supabase schema/migrations, auth, family creation & invites, manual board CRUD (so the board works even before AI).
- **Phase 2 — The magic:** capture flows, extraction edge function with Claude, proposal review cards.
- **Phase 3 — Habit:** push reminders, morning digest, grocery list auto-aggregation, share-sheet.
- **Phase 4 — Growth:** invite loops polish, onboarding ("photograph your fridge calendar"), TestFlight/Play beta.

**Business model (later):** free for core family use; premium tier (~$8–12/mo per family) for email auto-ingestion, calendar sync, multi-household (divorced/eldercare setups), and the proactive planning engine.

## What I'll do in this repo upon approval

1. Write `PLAN.md` (this idea + build plan) at the repo root.
2. Scaffold Phase 1: Expo TypeScript app structure + `supabase/` migrations for the data model above.
3. Commit and push everything to `claude/genesis-startup-discovery-rk9rrv`.

## Verification

- App boots in Expo; auth + family creation + manual board CRUD work against Supabase locally.
- Migrations apply cleanly; `git log` confirms commits pushed to the designated branch.
