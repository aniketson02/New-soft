# Hearth — Phase 2/3: Make It a Real, Working, Amazing App

## Context

Phase 1 is committed and pushed on `claude/genesis-startup-discovery-rk9rrv`: Expo app (auth, family create/join, realtime board, manual items, text capture), Supabase schema (`supabase/migrations/0001_init.sql`), and the Claude extraction edge function (`supabase/functions/extract/index.ts`). Nothing is provisioned yet — the app has no live backend and the AI loop is not wired end-to-end. The user is away, wants me to proceed autonomously, and the goal is "an app which is amazing" — i.e., the full magic loop working for real, and something the user can actually open and see.

The Supabase MCP server is connected to this session, and so is Vercel — so I can provision a real backend and ship a live web preview.

## What I'll build

### 1. Provision the real backend (Supabase MCP)
- `list_organizations` → `get_cost` → `confirm_cost` if required → `create_project` (free tier if available).
- Apply `0001_init.sql` via `apply_migration`.
- Deploy the `extract` edge function via `deploy_edge_function`.
- Get project URL + publishable (anon) key; write local `.env` (gitignored) and bake the same values into `app.json` `expo.extra` fallback so the committed repo runs out of the box (publishable keys are client-safe by design).
- Run `get_advisors` and fix anything security-critical it flags.
- Extraction trigger: instead of relying on a dashboard-configured webhook (can't be set via MCP), invoke the `extract` function directly from the app after inserting a capture (`supabase.functions.invoke`). Keep the function idempotent.
- Note: the edge function needs an `ANTHROPIC_API_KEY` secret which cannot be set via MCP — document the one-command step in README; the function must fail gracefully (capture marked `error` with a clear message) until the key is set.

### 2. Close the magic loop in the app (Phase 2 features)
- **Proposal review cards** — new `ReviewScreen` + a badge/banner on the board when pending proposals exist. Accept (→ insert into `items`, mapping `owner_hint` to a member by name, `list_name` to a list, creating it if needed), edit title/date inline, or dismiss. Realtime subscription on `proposals` so cards appear moments after a capture.
- **Photo capture** — `expo-image-picker` (pinned version from `expo/bundledNativeModules.json`, plain `npm install` since `expo install` is proxy-blocked): pick/take photo → upload to `captures` storage bucket under `familyId/...` → insert capture row → invoke extract. Extend the edge function to handle `kind='photo'`: download via service-role storage API, base64 → Claude vision message.
- **Grocery/lists view** — `ListsScreen` showing list entries grouped by list with check-off; `list_entry` items stop being invisible.

### 3. Make it feel great (Phase 3 polish)
- Board: member color avatars (deterministic per member), overdue highlighting, "done" fade-out, pending-review banner, pull-to-refresh already there.
- A "Today" greeting header (date + counts) — the seed of the morning digest.
- Better empty states and small copy polish throughout.

### 4. Ship a viewable app (Vercel)
- Add `react-native-web` + `react-dom` (Expo-pinned versions), `npx expo export --platform web` with `EXPO_OFFLINE=1`.
- Deploy the static export to Vercel via the MCP `deploy_to_vercel` tool → a live URL the user can open on their phone/laptop, sign in with email OTP, and use the real app against the real backend.

### 5. Verify, commit, push
- `npx tsc --noEmit` and iOS + web `expo export` bundle checks.
- End-to-end sanity via Supabase MCP `execute_sql`: create test rows the way RPCs would, confirm RLS behaves (anon role blocked, member visible).
- Exercise the live web deployment (fetch the URL, confirm it serves the app bundle).
- Update `README.md` + `PLAN.md` status; commit and push to `claude/genesis-startup-discovery-rk9rrv` (no PR).

## Key files
- Modify: `App.tsx`, `src/screens/BoardScreen.tsx`, `src/screens/CaptureScreen.tsx`, `src/lib/supabase.ts` (extra-config fallback), `supabase/functions/extract/index.ts`, `README.md`, `app.json`, `package.json`.
- New: `src/screens/ReviewScreen.tsx`, `src/screens/ListsScreen.tsx`, `src/components/Avatar.tsx` (small), `src/lib/acceptProposal.ts`.
- Reuse: `useAppState` context, `theme.ts`, `types.ts` (`ProposalPayload` already defined), existing RLS/RPCs.

## Risks / fallbacks
- If Supabase project creation requires a paid confirmation I can't justify, fall back to: keep code fully wired, document setup, still deploy the web build pointing at placeholder env with a friendly "connect your Supabase" error screen.
- If Vercel deploy tooling fails through the proxy, commit the web export config anyway and note the one-command deploy.
- Anthropic API key for the edge function cannot be provisioned autonomously — documented, graceful failure until set.

## Verification
- Type-check + Metro bundle (ios) + web export succeed.
- Migration applied: `list_tables` shows all six tables; advisors clean of criticals.
- Live URL responds with the app; auth screen renders.
- Insert test capture via SQL → extract function invoked → proposal row appears (will show graceful error until ANTHROPIC_API_KEY is set; verified the error path marks the capture correctly).
