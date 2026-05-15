# Mike 2.1 Phase 1 — Deploy Checklist

Branch: `claude/focused-moore-5961be`
Date: 2026-05-13
Status: **All smoke checks passing.** Ready for manual setup and deploy.

---

## 1. Smoke results

| Step                     | Result   | Notes                                                                                                                              |
| ------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `backend npm run build`  | **PASS** | `tsc` exits clean, no diagnostics.                                                                                                 |
| `backend npm test`       | **PASS** (with caveat) | 22/22 source tests pass (`npx vitest run src`). The unscoped `vitest run` picks up the compiled `dist/__tests__/*.js` files and they fail to import vitest (CJS bundling). Pure tooling artefact — not a regression. See follow-ups. |
| `frontend npm run test`  | **PASS** | 12/12 tests pass in 1.02s, 5 files.                                                                                                |
| `frontend npm run build` | **PASS** | Next.js 16.0.3 Turbopack build with stub Supabase envs. All 15 static pages generated. Routes `/login`, `/signup`, `/pricing`, `/account/billing` present. |

Critical files verified present:
- `frontend/src/app/login/page.tsx`, `signup/page.tsx`, `pricing/page.tsx`
- `frontend/src/app/(pages)/account/billing/page.tsx`, `(pages)/layout.tsx`
- `frontend/src/components/chrome/{icon-rail,secondary-nav,trial-banner}.tsx`
- `frontend/src/lib/billing.ts`
- `backend/src/lib/llm/gateway.ts`, `lib/stripe.ts`
- `backend/src/middleware/requireActiveSubscription.ts`
- `backend/src/routes/billing.ts`
- `backend/migrations/001_add_subscriptions.sql`

Paywall coverage in `backend/src/index.ts` (lines 128–143) — `requireActiveSubscription` applied to:
- `POST /chat`
- `POST /projects/:projectId/chat`
- `POST /tabular-review/:reviewId/chat`
- `POST /tabular-review/:reviewId/generate`

All four AI generation entrypoints are gated. Confirmed.

Removal of user API-key UX confirmed:
- `grep -ri "api key" frontend/src/app/{login,signup,pricing}` returns no matches.
- `frontend/src/app/(pages)/account/models/` directory does not exist.

---

## 2. What's deployable now

Assuming the env is fully set and Stripe + Supabase are configured per Section 3, the following work end-to-end:

- **Auth**: Signup (firm name + email + password), login, Supabase-backed session. New users get a `subscriptions` row auto-provisioned with `tier=trial`, `status=trialing`, 14-day trial, 1M-token monthly limit (DB trigger).
- **App chrome**: 64px IconRail + 224px SecondaryNav split, redesigned shadcn primitives, design tokens applied. Trial banner surfaces remaining trial days from `/api/billing/me`.
- **LLM routing**: All LLM traffic goes through Vercel AI Gateway (`backend/src/lib/llm/gateway.ts`). Direct provider SDKs (`claude.ts`, `gemini.ts`, `openai.ts`) deleted. Platform pays for inference.
- **Paywall**: 4 generation endpoints reject with HTTP 402 when subscription is not `trialing`/`active` or trial expired. Frontend 402 interceptor redirects to `/pricing`.
- **Stripe billing**: Pricing page (Starter/Professional/Enterprise), billing settings page, Stripe Checkout via `POST /api/billing/checkout`, webhook handler at `POST /api/billing/webhook` consuming `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`.
- **Token accounting**: Post-stream fire-and-forget increment of `tokens_used_this_period` (see `backend/src/lib/llm/gateway.ts`); counter reset on `checkout.session.completed`.

---

## 3. Manual setup required before first deploy

Numbered, in execution order. **Do these in a test environment first.**

### 1. Stripe — create products and prices

In Stripe Dashboard → Products, create three products with recurring monthly prices:

| Product       | Price (USD/month) | Result                |
| ------------- | ----------------- | --------------------- |
| Starter       | $99               | `price_…` → env var   |
| Professional  | $249              | `price_…` → env var   |
| Enterprise    | $499 (or custom)  | `price_…` → env var   |

Paste the three `price_…` IDs into backend env:
- `STRIPE_PRICE_STARTER=price_…`
- `STRIPE_PRICE_PROFESSIONAL=price_…`
- `STRIPE_PRICE_ENTERPRISE=price_…`

Use **test mode** prices for dev/staging, **live mode** prices for production. Trial tier has no Stripe price — handled entirely in DB.

### 2. Stripe — configure webhook endpoint

In Stripe Dashboard → Developers → Webhooks:

- **Endpoint URL**: `https://<backend-host>/api/billing/webhook`
- **Events to subscribe** (exactly these five):
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
- Copy the signing secret → `STRIPE_WEBHOOK_SECRET=whsec_…` in backend env.

**Webhook config note**: The endpoint must subscribe to `invoice.paid` in addition to the existing four events — the handler resets `tokens_used_this_period` to 0 on each monthly renewal (gated on `billing_reason ∈ {subscription_cycle, subscription_create}` so one-off invoices and mid-cycle prorations don't grant a fresh budget). For local CLI forwarding: `stripe listen --events invoice.paid,checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted --forward-to localhost:8080/billing/webhook`.

### 3. Supabase — apply migration and backfill

In Supabase SQL editor (or via `supabase db push`):

```sql
-- 1. Run the migration
\i backend/migrations/001_add_subscriptions.sql
```

The migration installs a trigger that auto-provisions new signups. **Existing users predate the trigger** and have no `subscriptions` row, which will cause `requireActiveSubscription` to 402 them. Backfill with:

```sql
INSERT INTO public.subscriptions (user_id, tier, status, trial_ends_at, monthly_token_limit, period_started_at)
SELECT u.id, 'trial', 'trialing', now() + interval '14 days', 1000000, now()
FROM auth.users u
LEFT JOIN public.subscriptions s ON s.user_id = u.id
WHERE s.id IS NULL
ON CONFLICT DO NOTHING;
```

### 4. Backend env vars

Set in your hosting platform (Railway/Fly/Vercel-backend/etc.):

**Required**:
- `PORT` (host-provided in most cases)
- `FRONTEND_URL` — e.g. `https://app.mike.ai` (used for CORS + Stripe success/cancel URLs)
- `DOWNLOAD_SIGNING_SECRET` — `openssl rand -hex 32`, distinct from Supabase key
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (service-role key)
- `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- `AI_GATEWAY_API_KEY` — Vercel AI Gateway static key. **Mandatory unless deploying on Vercel with OIDC** (in which case `VERCEL_OIDC_TOKEN` is auto-provisioned by `vercel env pull`).
- `STRIPE_SECRET_KEY` (`sk_test_…` or `sk_live_…`)
- `STRIPE_WEBHOOK_SECRET` (`whsec_…`)
- `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PROFESSIONAL`, `STRIPE_PRICE_ENTERPRISE`

**Optional**:
- `RESEND_API_KEY` — only if transactional email is wired in your deployment path.

### 5. Frontend env vars

For Cloudflare/Vercel/wherever the Next.js app runs:

**Required**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `NEXT_PUBLIC_API_BASE_URL` — e.g. `https://api.mike.ai`
- `SUPABASE_SECRET_KEY` — required by server-only routes that read profile data with service role.

### 6. Vercel AI Gateway

In the Vercel project hosting the **backend** (or your gateway-owning Vercel project):

- Dashboard → Settings → AI Gateway → Enable.
- Generate a static key OR enable OIDC for the deployed environment.
- Confirm spend limits / model allowlist match the gateway slugs referenced in `backend/src/lib/llm/gateway.ts` (see Section 4 — the slug naming is a known follow-up).

---

## 4. Known follow-ups (technical debt parked)

Carry these into the Phase 1 hotfix backlog. None block first deploy, but each is real.

1. **Dead modal imports**: `ApiKeyMissingModal` and `modelAvailability` are still imported by chat and tabular components, but the backend no longer triggers them (all routing is through AI Gateway with platform-paid keys). Needs a UI-cleanup pass to remove the imports and the modals themselves.
2. ~~**Token counter resets only on checkout**~~ **RESOLVED** (Phase 1 cleanup): `invoice.paid` is now handled in `backend/src/routes/billing.ts` and resets `tokens_used_this_period` + `period_started_at` on subscription renewals (gated on `billing_reason ∈ {subscription_cycle, subscription_create}`). Stripe webhook endpoint must include `invoice.paid` in subscribed events — see Section 2.
3. **No seat enforcement**: `subscriptions` schema models per-user tiers but multi-seat tiers (Professional / Enterprise) have no seat count, no invitation flow, and no per-seat usage attribution. Enterprise sales conversations will hit this immediately.
4. **Enterprise CTA placeholder** — **BLOCKS public launch**: `/pricing` Enterprise tier links to `mailto:sales@mike.ai` (marked in code with `data-cta="enterprise-mailto"` and an inline TEMP comment as of cleanup batch C). Two real gaps: (a) the `sales@mike.ai` mailbox is not yet provisioned, so the link goes nowhere, and (b) browsers without a configured mail client (most modern desktop browsers by default) treat `mailto:` as a no-op, making the CTA feel broken. Before public launch, **either** provision the mailbox **and** verify the `mailto:` opens a usable client on macOS/Windows defaults, **or** swap the CTA for a real scheduling URL (Calendly) or HubSpot form.
5. **Mobile chrome gap**: At `<md` breakpoint both nav columns are hidden — no drawer/hamburger fallback yet. Mobile users are stuck on the home route. P2 for first launch since target audience (law firm desktops) is desktop-first.
6. **Nav points at non-existent `/playbooks`**: SecondaryNav entry for Playbooks is wired up but `/playbooks` page doesn't exist. Will 404. Either stub a "coming soon" page or hide the nav entry until Phase 2.
7. **Live AI Gateway smoke not run**: Tooling added — `npm run smoke:gateway` (Phase 1 cleanup batch D). Manual smoke required pre-prod. Streaming, tool calls, and cost attribution have not been manually verified end-to-end against a real `AI_GATEWAY_API_KEY`. Run a chat + a tabular generation against staging before flipping production traffic.
8. **Gateway model-slug naming**: Tooling added — `npm run test:gateway-live` (Phase 1 cleanup batch D). Run pre-prod. `backend/src/lib/llm/gateway.ts` maps to slugs like `anthropic/claude-sonnet-4.6`, `google/gemini-3-flash-preview`, `openai/gpt-5.5`. Verify against `curl -s https://ai-gateway.vercel.sh/v1/models | jq '.data[].id'` before deploy — Vercel may rename preview-suffixed slugs. The skill prerequisite explicitly warns: **always fetch current model IDs**.
9. **Backend test runner picks up `dist/`**: After `tsc`, `vitest run` finds compiled `dist/__tests__/*.js` and fails to import vitest (CJS). Either add `vitest.config.ts` with `include: ['src/**/*.test.ts']`, gitignore-style exclude `dist`, or run `npx vitest run src` in CI. Not blocking — tests in source pass.

---

## 5. Suggested next phase (per `docs/architecture.html`)

Phase 2 — 5-week effort:

- **Playbooks system** — author + execute named multi-step legal workflows; first-class entity in the chrome.
- **Tabular Review enhancement** — better column types, batch operations, exportable artifacts.
- **Inline AI editing** — TipTap-based inline rewrites and suggestions inside documents.
- **Arabic RTL** — full bidi support across chrome, chat, tabular, and rendered legal docs. Targets the Middle East GTM.
- **WorkOS SSO** — enterprise SSO/SCIM for firm-wide deployments. Pairs with seat enforcement (follow-up #3).

Phase 1 ships first; Phase 2 starts after a week of bug-bash and early-customer feedback on the trial flow.
