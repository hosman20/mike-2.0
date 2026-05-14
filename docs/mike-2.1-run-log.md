# Mike 2.1 Phase 1 — Run Log

Started: 2026-05-13
Branch: claude/focused-moore-5961be
Worktree: /Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be
Base commit: 469ee4a

## How to revert a specific batch

```
git log --oneline main..HEAD               # see all batches
git revert <sha>                           # undo a single batch
git revert --no-commit <sha1> <sha2> ...   # undo a range, single revert commit
```

## Decisions made

- **AI gateway**: chose Vercel AI Gateway over OpenRouter (user-confirmed; matches `docs/architecture.html`).
- **Bespoke unprefixed tokens** are the production family (`F:*` shadcn and `B:*` nitro kits in `.pen` are reference only).
- **Tailwind v4** `@theme inline` kept (frontend already configured).
- **AI SDK v6 install path** used (vs direct HTTP) — gateway routing auto-resolved via `"provider/model"` model strings.
- **Stripe migration** uses `CREATE IF NOT EXISTS` for idempotency.
- **Token tracking** is fire-and-forget AFTER stream completes (never blocks hot path).
- **Bespoke commit-per-batch policy** adopted retroactively for revertability.

## Batches

### Batch 1 — Design tokens + 4 primitives (commit: 7b4dcce)

- Sub-agent: general-purpose (agentId: `a4c766b6e2d6a274e`)
- Goal: replace `globals.css` `@theme` with Mike 2.1 tokens; rebuild Button / Input / Badge / Dropdown.
- Files touched:
  - `frontend/src/app/globals.css`
  - `frontend/src/components/ui/{button,input,badge,dropdown-menu}.tsx`
  - `frontend/vitest.config.ts`, `frontend/vitest.setup.ts`
  - `frontend/package.json`, `frontend/package-lock.json` (vitest test deps)
- Tests added: `frontend/src/components/ui/__tests__/primitives.smoke.test.tsx` (3 tests)
- Build/test result: PASS / 3 tests pass
- Notes: kept `--color-blue` / `--color-azure` as faded blue for legacy legal-doc CSS (`.usc-section`, `.cfr-section`); kept `--font-eb-garamond` `next/font` wiring for legacy `.font-eb-garamond` utility.
- Revert command: `git revert 7b4dcce`

### Batch 2 — Auth pages (commit: 3c8ffa8)

- Sub-agent: general-purpose (agentId: `a98a89fd5a4635549`)
- Goal: migrate login + signup to Mike 2.1 chrome.
- Source design: `.pen` frames S9ZQTA / tbg1h / gtQ5F (login) / V3Q1xu (signup).
- Files:
  - `frontend/src/app/login/page.tsx`
  - `frontend/src/app/signup/page.tsx`
  - `frontend/src/components/site-logo.tsx`
  - `frontend/src/app/__tests__/auth-pages.smoke.test.tsx`
- Decisions: organisation field made REQUIRED (B2B product); kept confirm-password field (functionality preservation); WorkOS-SSO and magic-link buttons NOT lifted (no wired primitive).
- Tests: 2 smoke tests, PASS.
- Revert: `git revert 3c8ffa8`

### Batch 3 — Chrome (IconRail + SecondaryNav) (commit: 571af72)

- Sub-agent: general-purpose (agentId: `a36447602e8db8572`)
- Goal: split old `AppSidebar` into 64px `IconRail` + 224px `SecondaryNav`.
- `.pen` refs: wF9tL / x72bX / FdYC1 / yEGYQ / QxArF / CzlFI.
- Files:
  - `frontend/src/components/chrome/icon-rail.tsx`
  - `frontend/src/components/chrome/secondary-nav.tsx`
  - `frontend/src/app/(pages)/layout.tsx` (chrome-split portion only — TrialBanner mount appended in Batch 6)
  - `frontend/src/components/chrome/__tests__/chrome.smoke.test.tsx`
- Notes: Old `AppSidebar.tsx` left on disk in this batch (removed in Batch 7); mobile `<md` hides both columns (no drawer yet); Playbooks nav entry added.
- Tests: `chrome.smoke.test.tsx`, PASS.
- Revert: `git revert 571af72`

### Batch 4 — Vercel AI Gateway (commit: 07a46ce)

- Sub-agent: vercel:ai-architect (agentId: `a5511de9cafb2355a`)
- Goal: replace direct provider SDKs with AI Gateway via AI SDK v6.
- Path chosen: AI SDK v6 (`ai@^6.0.182`), gateway provider bundled, `"provider/model"` strings auto-route.
- Deleted: `claude.ts`, `gemini.ts`, `openai.ts`, `tools.ts`, `userApiKeys.ts`, `frontend/src/app/(pages)/account/models/`.
- Added: `gateway.ts`, `gateway.test.ts` (12 tests).
- Model ID mapping: see `backend/src/lib/llm/gateway.ts`. Verify against `https://ai-gateway.vercel.sh/v1/models` before deploy (deploy-checklist §4.8).
- Env: `AI_GATEWAY_API_KEY` required; removed `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `OPENAI_API_KEY` / `USER_API_KEYS_ENCRYPTION_SECRET` from `.env.example`.
- Backward-compat: `UserApiKeys` type kept as `@deprecated` alias.
- Files split across other commits for this batch:
  - `frontend/src/app/lib/mikeApi.ts` `getApiKeyStatus` removal is in Batch 7 (commit `9974612`) — the function is dead between commits `07a46ce` and `9974612` but harmless.
  - `frontend/src/app/(pages)/account/layout.tsx` had its tab line touched in both Batches 4 (Models tab removed) and 6 (Billing tab added). To produce a clean intermediate state, this commit shows the tab gone entirely; Batch 6 re-adds it pointing at `/account/billing`.
- Revert: `git revert 07a46ce` (note: produces conflicts if Batches 5/6 are still applied — revert those first).

### Batch 5 — Stripe + paywall (commit: ba00445)

- Sub-agent: general-purpose (agentId: `aa83ddc67d4dfac03`)
- Goal: subscriptions table, webhook, paywall middleware on chat routes.
- Migration: `backend/migrations/001_add_subscriptions.sql` (idempotent, RLS, auto-provision trigger for new users).
- New files: `stripe.ts`, `billing/usage.ts`, `routes/billing.ts`, `requireActiveSubscription.ts`, two test files.
- Paywall coverage: `POST /chat`, `/projects/:id/chat`, `/tabular-review/:id/chat`, `/tabular-review/:id/generate`.
- Stripe events handled: `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`.
- Frontend interceptor: 402 → `/pricing?reason=...` (added to `mikeApi.ts` in this commit).
- Tests: 10 new (6 middleware + 4 webhook).
- Notes:
  - `backend/package-lock.json` carries deps from both Batch 4 (`ai`) and Batch 5 (`stripe`, `vitest`). Committed in full with this batch.
  - `recordTokenUsage` calls in `routes/{chat,projectChat,tabular}.ts` are part of this batch (added on top of Batch 4's gateway plumbing).
- Revert: `git revert ba00445`

### Batch 6 — Pricing + billing UI (commit: d3956d0)

- Sub-agent: general-purpose (agentId: `ad65cb0ceb7e70da6`)
- Goal: `/pricing` page, `/account/billing` page, trial banner.
- `/pricing` publicly accessible (lands logged-out users from 402 redirect).
- Banner placement: top of `<main>` in `(pages)/layout.tsx`.
- Extended user profile API to include `subscription` block.
- Re-adds the "Billing" tab in `(pages)/account/layout.tsx` (originally removed alongside the "Models & API Keys" tab in Batch 4).
- Tests: 5 new (3 pricing + 2 billing).
- Stub: Enterprise CTA `mailto:sales@mike.ai` (placeholder).
- Revert: `git revert d3956d0`

### Batch 7 — Dead code cleanup (commit: 9974612)

- Sub-agent: refactor-cleaner (agentId: `aca933ce4c3383624`)
- Removed:
  - `AppSidebar.tsx` (311 LOC)
  - `credits-exhausted-modal.tsx` (81 LOC)
  - `getApiKeyStatus()` from `mikeApi.ts` (4 LOC)
- Left alone (still has active importers): `ApiKeyMissingModal`, `modelAvailability` helpers.
- Revert: `git revert 9974612`

### Batch 8 — Smoke + deploy checklist (this commit — see below)

- Sub-agent: general-purpose (agentId: `a6969272e17743cb6`)
- Final: `docs/mike-2.1-deploy-checklist.md`
- Verified backend + frontend builds clean.
- Revert: `git revert <this commit>`

### Batch 10 — Dev bypass (commit: <pending>)

- Goal: NODE_ENV-gated auth + paywall bypass for local previews. Lets the
  team open authenticated pages without real Supabase / Stripe creds.
- Flags introduced:
  - `NEXT_PUBLIC_DEV_AUTH_BYPASS` (frontend) — only honored when `NODE_ENV !== 'production'` AND value is exactly `"1"`.
  - `DEV_AUTH_BYPASS` (backend) — same contract.
- Frontend bypass behaviour:
  - `AuthProvider` returns a stub user (UUID `00000000-0000-0000-0000-000000000dev`) + `isAuthenticated: true` without touching Supabase.
  - `UserProfileProvider` injects a Professional-tier active subscription stub (35M tokens / 0 used / 30-day period end) instead of hitting `/user/profile`.
  - `(pages)/layout.tsx` skips the `/login` redirect.
  - `mikeApi.ts` 402 interceptor logs + rethrows instead of redirecting to `/pricing`.
  - Amber `DevBanner` strip rendered above `TrialBanner`.
- Backend bypass behaviour:
  - `requireAuth` populates `res.locals.userId` with the stub UUID and short-circuits before JWT verification.
  - `requireActiveSubscription` returns `next()` immediately, skipping the `subscriptions` table lookup.
  - `src/index.ts` emits a visible `console.warn` at boot when the flag is on.
- Files touched:
  - Added: `backend/src/lib/devAuth.ts`, `backend/src/middleware/__tests__/devAuth.test.ts`, `frontend/src/lib/devAuth.ts`, `frontend/src/lib/__tests__/devAuth.test.ts`, `frontend/src/components/chrome/dev-banner.tsx`
  - Modified: `backend/.env.example`, `backend/src/index.ts`, `backend/src/middleware/auth.ts`, `backend/src/middleware/requireActiveSubscription.ts`, `frontend/.env.local.example`, `frontend/src/app/(pages)/layout.tsx`, `frontend/src/app/lib/mikeApi.ts`, `frontend/src/contexts/AuthContext.tsx`, `frontend/src/contexts/UserProfileContext.tsx`
- Tests: 3 new backend (`devAuth.test.ts`) + 6 new frontend (`devAuth.test.ts`). All existing tests still pass when the flag is unset.
- Build: PASS (backend `tsc`, frontend `next build`) with both flags unset and set to `1`.
- Hard production safety: `isDevAuthBypass` is a const evaluated as `process.env.NODE_ENV !== 'production' && process.env.{FLAG} === '1'`. Production deployments ignore the flag by NODE_ENV check — the gate cannot be defeated without code changes.
- Revert command: `git revert <commit-sha>`

## Spec docs produced (not part of any single feature batch)

Both shipped in commit `3da5dd9` (`docs(mike-2.1): add design tokens and frontend inventory specs`):

- `docs/mike-2.1-design-tokens.md` (Batch 0a, agentId `a431cf5ab43329570`)
- `docs/mike-2.0-frontend-inventory.md` (Batch 0b, agentId `ad8271abf2f042093`)

## Future loop policy

ALWAYS commit a batch before dispatching the next agent. Pattern per batch:

1. Dispatch agent.
2. Verify build/tests.
3. `git add <files-from-batch>`.
4. `git commit -m "<type>: <description>"` with batch metadata.
5. Dispatch next agent.

## Deviations from suggested grouping

- **`frontend/src/app/(pages)/layout.tsx`**: file diff is split across Batches 3 (chrome wiring) and 6 (TrialBanner mount). Resolved cleanly with two `Edit` passes — Batch 3 commit holds the chrome-only version; Batch 6 commit adds `TrialBanner`.
- **`frontend/src/app/(pages)/account/layout.tsx`**: a single line (`{ id: "models", ... }` → `{ id: "billing", ... }`) was touched by both Batch 4 (delete Models tab) and Batch 6 (add Billing tab). Split into two passes: Batch 4 leaves only the "General" tab; Batch 6 re-adds the Billing tab.
- **`backend/src/routes/{chat,projectChat,tabular}.ts`**: the `attribution: { userId }` refactor (Batch 4) and the `recordTokenUsage` call (Batch 5) both modify the same hunks. Split cleanly via temporary edits: Batch 4 commit captures the attribution + apiKeys removal; Batch 5 commit adds the `recordTokenUsage` import + `void recordTokenUsage(...)` block.
- **`backend/src/routes/user.ts`**: API-key route deletions (Batch 4) and the subscription serialization (Batch 6) both touch `serializeProfile` / `loadProfile`. Split via temporary edits.
- **`frontend/src/app/lib/mikeApi.ts`**: three independent changes (Batch 5: 402 interceptor; Batch 6: SubscriptionInfo types + `subscription` field on `UserProfile`; Batch 7: `getApiKeyStatus` removal) — all separated cleanly via `Edit`.
- **`backend/.env.example`** and **`backend/package.json`**: AI Gateway entries (Batch 4) vs Stripe + vitest entries (Batch 5/6) split via `Edit`.
- **`backend/package-lock.json`**: not split — it contains intertwined lockfile entries for `ai` (Batch 4) and `stripe`/`vitest` (Batch 5/6) that cannot be cleanly separated without producing an inconsistent lockfile. Committed in full with Batch 5 (`ba00445`).
- **`backend/schema.sql`**: the appended subscriptions block belongs entirely to Batch 5; committed there.

## Known follow-ups (parked from deploy-checklist §4)

1. **Dead modal imports**: `ApiKeyMissingModal` and `modelAvailability` are still imported by chat and tabular components; backend never triggers them now. UI-cleanup pass needed.
2. **Token counter resets only on checkout**: `tokens_used_this_period` is zeroed on `checkout.session.completed` but not on `invoice.paid` for monthly renewals. Subscribe to `invoice.paid` and reset `period_started_at` + `tokens_used_this_period` to 0.
3. **No seat enforcement**: schema is per-user; multi-seat Professional / Enterprise tiers have no seat count, invitation flow, or per-seat attribution.
4. **Enterprise CTA placeholder**: `/pricing` Enterprise tier links to `sales@mike.ai` — set up the real mailbox or replace with a Calendly/HubSpot form before public launch.
5. **Mobile chrome gap**: at `<md` both nav columns are hidden — no drawer/hamburger fallback yet. P2 (desktop-first target).
6. **Nav points at non-existent `/playbooks`**: `SecondaryNav` entry exists but `/playbooks` page doesn't. Stub a "coming soon" page or hide the nav entry until Phase 2.
7. **Live AI Gateway smoke not run**: streaming, tool calls, and cost attribution have not been verified end-to-end against a real `AI_GATEWAY_API_KEY`. Run chat + tabular generation against staging before flipping prod traffic.
8. **Gateway model-slug naming**: verify slugs against `curl -s https://ai-gateway.vercel.sh/v1/models | jq '.data[].id'` — Vercel may rename preview-suffixed slugs.
9. **Backend test runner picks up `dist/`**: after `tsc`, `vitest run` finds compiled `dist/__tests__/*.js` and fails to import vitest (CJS). Add `vitest.config.ts` with `include: ['src/**/*.test.ts']` and exclude `dist`, or run `npx vitest run src` in CI.

## Commit index

| # | SHA       | Subject                                                                                |
|---|-----------|----------------------------------------------------------------------------------------|
| 1 | `3da5dd9` | docs(mike-2.1): add design tokens and frontend inventory specs                         |
| 2 | `7b4dcce` | feat(design): apply Mike 2.1 tokens and redesign 4 shadcn primitives                   |
| 3 | `3c8ffa8` | feat(auth): migrate login and signup to Mike 2.1 chrome                                |
| 4 | `571af72` | feat(chrome): split AppSidebar into 64px IconRail and 224px SecondaryNav               |
| 5 | `07a46ce` | feat(llm): replace direct provider SDKs with Vercel AI Gateway                         |
| 6 | `ba00445` | feat(billing): add Stripe subscriptions and paywall middleware                         |
| 7 | `d3956d0` | feat(billing-ui): pricing page, billing settings, and trial banner                     |
| 8 | `9974612` | chore: remove dead code (AppSidebar, CreditsExhaustedModal, getApiKeyStatus)           |
| 9 | (this commit) | docs(mike-2.1): add deploy checklist and run log                                   |
