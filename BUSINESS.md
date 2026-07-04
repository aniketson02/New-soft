# Hearth — Business Operating Plan

Owner-mindset plan: fastest credible path from working product to paying
customers, spending as little as possible until retention is proven.

## Where the business stands (verified, not aspirational)

- **Product**: full magic loop live — capture (text/photo) → AI extraction →
  review cards → shared realtime board. Web app + Expo mobile codebase.
- **Distribution**: live at https://aniketson02.github.io/New-soft/ (landing +
  app), auto-deployed by CI on every push.
- **Infra cost**: $0/month (Supabase free tier, GitHub Pages, Gemini free tier).
- **Funnel instrumentation**: first-party events + email waitlist live as of
  this commit. Users/revenue: zero — everything below is about changing that.

## Business model

**Freemium family subscription.** Free: full board, manual + AI capture with
monthly cap. Premium (~$7.99/mo or $59/yr per *family*, not per seat):
unlimited AI captures, email forwarding ingestion, calendar sync,
multi-household (divorced parents, eldercare), proactive planning digests.

Why this model: the buyer (household manager, usually a parent aged 28–45) has
high willingness to pay for *time and sanity*; family-level pricing keeps the
viral loop (invites) free of per-seat friction.

**North-star metric**: weekly active families with ≥3 accepted proposals.
That single number proxies retention, AI value, and future revenue.

## Activation funnel (now instrumented)

`landing_view → open_app_clicked → sign_in → family_created →
capture_created → proposal_accepted → invite_shared → family_joined`

Read it with SQL (service role): `select name, count(*) from events group by 1`.

## 30-day plan

1. **Week 1 — prove activation with 10 hand-recruited families.** Personal
   network + 2–3 parenting WhatsApp/Facebook groups. Watch the funnel, fix the
   biggest drop-off. Cost: $0.
2. **Week 2 — retention hooks.** Morning digest (email first — cheaper than
   push), grocery-list share-sheet. Ship weekly.
3. **Week 3 — mobile beta.** EAS build → TestFlight/Play internal track
   (needs your developer accounts, below). Waitlist emails get invites.
4. **Week 4 — first revenue test.** Paywall the AI cap with a "founder's
   lifetime deal" ($49 one-time, 20 units) to validate willingness-to-pay
   before building subscription infra.

## Connectors & services matrix

| Service | Purpose | Cost | Priority | Who |
|---|---|---|---|---|
| Supabase (current) | Backend | $0 → $25/mo at ~10k users | Critical | ✅ running |
| Gemini API (current) | AI extraction | $0 free tier → usage | Critical | ✅ running (rotate key when convenient) |
| GitHub Pages + Actions | Hosting + CI | $0 | Critical | ✅ running |
| **Custom domain** (e.g. hearth.family) | Brand trust, SEO, email sender | ~$12–35/yr | **High** | **You: purchase** |
| **Apple Developer** | iOS TestFlight + App Store | $99/yr | **High (week 3)** | **You: legal identity + payment** |
| **Google Play Console** | Android distribution | $25 once | **High (week 3)** | **You: same** |
| Resend / Postmark | Digest + waitlist emails | $0 free tier | High (week 2) | You: account (needs domain) |
| RevenueCat + Stripe/App Store billing | Subscriptions | $0 until $2.5k MRR | Medium (week 4+) | You: legal/financial |
| PostHog | Deeper analytics/session replay | $0 free tier | Medium | Optional — first-party events suffice now |
| Expo EAS | Cloud mobile builds | $0 free tier | High (week 3) | You: expo.dev account |
| Sentry | Crash reporting | $0 free tier | Medium | Can wait |
| Paid ads | Acquisition | $0 now | Low | Do NOT spend pre-retention |

**Budget to first revenue: ~$140–160 total** (domain + Apple + Play). Nothing
else should cost money until retention is proven — every free tier above
covers the first thousand users.

## Human involvement matrix

**I complete independently**: product, all code, backend, AI pipeline, landing
page/SEO, analytics, funnel fixes, docs, CI, store listing copy & ASO keyword
prep, email templates.

**Needs your credentials**: Apple Developer, Google Play, domain registrar,
Resend/email provider, expo.dev, Stripe/RevenueCat (when we monetize),
a rotated Gemini key when you're ready (current one was pasted in chat —
functional but treat as exposed).

**Needs your business decision**: final name/domain (Hearth is presumed —
check trademark comfort), price point ($59/yr recommended), launch geography
(recommend English-speaking first, though the product is language-agnostic).

**Needs your legal/financial approval**: developer account purchases, terms of
service/privacy policy publication (drafts I can write), payment processing.

## Honest risks

- **Cold-start habit risk**: families that don't capture in week 1 will churn;
  the onboarding must force one capture during signup (next product task).
- **Gemini free tier limits**: fine for hundreds of users, not thousands —
  revisit at scale (usage-based cost is still cents per family/month).
- **github.io URL reads as non-commercial** — the domain purchase is the
  single highest-leverage $12 in this plan.
- **Category graveyard**: Cozi et al. prove demand and mediocrity; our bet is
  zero-data-entry AI. If proposal_accepted rates are low, that bet is wrong —
  the funnel will tell us within two weeks of real usage.
