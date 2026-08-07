# UI Route and State Coverage

Exact route ledger with per-route boundary, state, and test evidence (2026-08-07). `rg` = grep over repository; e2e = Playwright runtime suites (chromium/firefox/webkit, local dev server). N/A entries are technical: static/public routes have no authenticated server-state owner, and demo routes must not expose authenticated mutations.

| Route | Boundary | Initial/loading | Refresh/stale | Error/recovery | Permission/empty | Test evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | Public shell | Static | N/A: no auth owner | Route error boundary | N/A | e2e: public family representative; `tests/ui`, `visual-regression`, `reduced-motion` |
| `/login` | Public shell | Form-local | N/A | Inline field errors | N/A | e2e `login` in visual/keyboard/reduced-motion suites |
| `/subscribe/status` | Public shell | `Loader2` spinner | `Refresh Status` refetch | Status-unavailable panel | N/A | e2e visual sweep; sticky-focus regression fixed via `<main id="main-content">` (2026-08-07) |
| `/docs`, `/not-found` | Public shell / 404 | Static | N/A | N/A | N/A | `tests/ui/docs-link-scan.test.ts`; e2e public family |
| `/reports/shared/[slug]` | Shared report shell | Route loading boundary | Server refresh | Error boundary | N/A | e2e `shared` family; `app/reports/shared/[slug]/loading.tsx` |
| `/demo` | Demo shell | Demo route boundary | Demo-local state only | Demo-safe recovery | N/A: no persisted mutation | e2e demo family + `phase-5-demo` (8 tests, 3 browsers) |
| `/dashboard` | Auth shell | DashboardLoadingSkeleton (status-only) | Realtime scoped invalidation | Inline retry | Empty/no-results states | `tests/components/skeleton-contracts.test.tsx`; e2e dashboard family representative |
| `/dashboard/journal` | Auth shell | Section skeletons | Realtime freshness | Inline retry | Empty journal state | e2e dashboard family; `async-states`/`daily-note-panel` tests |
| `/dashboard/reports` | Auth shell | Section skeletons | Realtime freshness | Inline retry | Empty report state | e2e dashboard family; `reports-page-client` tests |
| `/dashboard/table` | Auth shell | Row skeletons | Realtime freshness | Inline retry | Empty table | `trade-notes-tab`/table tests; e2e sweep |
| `/dashboard/trades/new` | Canonical trade entry | Route loading boundary | Draft preservation | Validation and retry | Account/permission validation | `tests/components/trade-workspace.test.tsx`, `trade-entry-draft` tests, `tests/ui/canonical-trade-entry-contracts.test.ts` |
| `/dashboard/accounts`, `/dashboard/accounts/[id]` | Auth shell | Page skeletons | Realtime freshness | Route error boundaries | Missing-account state | account contracts; e2e sweep at 320px |
| `/dashboard/import` | Auth shell | Import skeletons | Progress/partial preservation | Recoverable import errors | Disabled/offline states | `tests/components/import-form.test.tsx` (offline banner + retry), e2e sweep |
| `/dashboard/data` | Auth shell | Section skeletons | Realtime freshness | Inline retry | Empty states | `data-management` tests; e2e sweep |
| `/dashboard/ai`, `/dashboard/playbook`, `/dashboard/backtesting`, `/dashboard/goals`, `/dashboard/settings` | Auth shell | Section skeletons | Scoped invalidation | Inline retry | Empty states | `phase-5-ai`, `phase-5-playbook`, `phase-5-backtesting`, `phase-5-goals` e2e suites (pass on 3 browsers) |
| `/dashboard/prop-firm/accounts/[id]`, `.../trades`, `.../settings`, `.../payouts/request` | Auth shell | Page skeletons | Realtime freshness | Route error boundaries | Permission/missing-account | `prop-firm-settings-form`, `edit-prop-firm-form`, `phase-transition-dialog` tests; e2e propFirm family |
| `/dashboard/prop-firm`, `/dashboard/prop-firm/accounts` | Redirect aliases | N/A | N/A | N/A | N/A | Retained pending analytics approval; `architecture:check-routes` reports both |

E2E execution record (2026-08-07, local dev server, `--workers=1`): chromium 61 passed / 87 skipped, firefox 64 passed / 87 skipped, webkit 60 passed / 87 skipped, 0 failed. The 87 skipped scenarios are the authenticated journeys that require an explicit preview storage state (`PLAYWRIGHT_AUTH_STORAGE_STATE`), documented as a fixture limitation.
