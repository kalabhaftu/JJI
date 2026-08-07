# August 2026 Application UI/UX Refactor — Release Evidence

This refactor establishes scoped server-state ownership, session-safe realtime handling, stable semantic colors, accessible form and workflow primitives, centralized navigation, granular async states, and canonical trade entry at `/dashboard/trades/new`.

## Breaking routes and behavior

| Change | Before | After |
| --- | --- | --- |
| Docs donate destination | `/docs/donate` (obsolete nav target) | `/donate` |
| Trade entry | Modal-only overlay, account/prop-firm-specific routes | Canonical `/dashboard/trades/new` with `accountId`, `propFirmAccountId`, `phaseId`, `origin`, `returnTo` query context; deep-linkable and back-aware |
| Account-specific trade routes | `/dashboard/prop-firm/accounts/[id]/trades/new`, `/dashboard/accounts/[id]/trades/new` | Removed (internal-only; see route-removal inventory) |
| Prop-firm landing | `/dashboard/prop-firm`, `/dashboard/prop-firm/accounts` | Retained as redirect aliases to `/dashboard/accounts?filter=prop-firm`, pending approval and external-consumer analytics evidence |
| 404 catch-all | `[...not-found]` with `notFound()` | Retained; unreachable markup after `notFound()` removed (2026-08-07) |

Credential reconnection: users with previously persisted Tradovate (and other immutable provider) credentials must reconnect the integration — client-persisted provider credentials were removed during the refactor.

## Cache and identity behavior

- Private query, SWR, module, and provider state is cleared across identity transitions (logout, demo/auth switch, user A/B). Demo data remains isolated from authenticated caches.
- Realtime updates invalidate only the affected server-state domain instead of broad refetching.
- Server-side aggregates replace the large client-side metrics transfer from dashboard startup.

## Visual baseline status

`tests/e2e/visual-regression.e2e.test.ts` is present, but no committed visual baselines exist in this workspace; final baseline generation and approval is pending and owned by the visual regression agent. Treat the visual gate as not-yet-approval until baselines are captured.

## Detector evidence

- Route and dead-code integrity detectors are implemented and wired into CI:
  - `scripts/check-route-integrity.mjs` → `bun run architecture:check-routes`
  - `scripts/check-dead-code.mjs` → `bun run architecture:check-dead-code`
- **No approved Impeccable CLI detector is installed in this environment — deferred with release risk.** No approved detector command is installed; the plan's single detector pass (Phase 8 Task 8.3 Step 4) must run on a machine with the approved CLI before final release sign-off.
- Analytics evidence for the persisted prop-firm redirect aliases (`/dashboard/prop-firm`, `/dashboard/prop-firm/accounts`) is **pending** and required before their removal is approved.

## Rollback

Rollback is performed by reverting the refactor commits on `preview`/staging. No database migration is required for the shared UI foundations. After reverting, re-verify the donate route, canonical trade entry, auth cache isolation, and prop-firm redirects before re-promoting.

## Support guidance

- Ask users to reconnect provider credentials after deployment if they were connected before this release.
- Ask users to refresh once after deployment if cached application state predates this release.
- Direct donation references to `/donate`, not `/docs/donate`.

## Verification

2026-08-07 local validation against the dev server (single-worker Playwright on chromium/firefox/webkit):

- `bunx tsc --noEmit` exit 0
- Vitest 735/735 pass
- ESLint 0 errors (13 pre-existing exhaustive-deps warnings)
- Production build `✓ Compiled successfully`, 160 static pages
- Playwright: chromium 61 passed / 87 skipped, firefox 64 passed / 87 skipped, webkit 60 passed / 87 skipped, 0 failed in any browser; the 87 skipped scenarios need an authenticated preview storage state
- Eight `architecture:check-*` gates, `security:scan-console`, and `tests/ui/docs-link-scan.test.ts` all exit 0
- `bun audit` reports 3 high + 1 moderate upstream advisories (fast-uri, brace-expansion, hono, js-yaml) — identical on `main`, pre-existing and not introduced by this refactor

Route and dead-code integrity checks pass in this environment (`architecture:check-routes`, `architecture:check-dead-code`), the docs link scan passes (`tests/ui/docs-link-scan.test.ts`), and the test/TypeScript checks are green. Route-removal evidence is tabulated in `docs/releases/route-removal-inventory.md`.