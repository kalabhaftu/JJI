# Route Removal Inventory

Phase 8 (Task 8.1) route-removal evidence gate. Records `RouteRemovalRecord` fields for every route the plan lists:

- `route`, `classification`, `canonicalReplacement`, `callers`, `removal` `analyticsStatus`, `approval`, `evidence`.

Analytics is unavailable in this workspace, so retained routes requiring external-consumer evidence were **not** removed. The route scanner reports but never removes non-approved paths (`scripts/check-route-integrity.mjs`).

| Route | Classification | Canonical replacement | Callers (rg / git grep) | Analytics | Approval | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `/docs/donate` | `internal-only` | `/donate` | `app/docs/docs-layout-client.tsx:356` (active-match), old link was 102-104; migrated consumers: `lib/navigation/registry.ts:59`, `app/about/page.tsx:65`, `app/contact/page.tsx:83`, `app/feedback/layout.tsx:14`, `components/layouts/public-layout.tsx:15` | `unavailable` | Not required (no external consumer recorded) | Obsolete path removed/no `app/docs/donate` route; `docs-link-scan.test.ts` + route scanner reject regressions; `git grep '/docs/donate'` hits only the regression test and scanner |
| `/dashboard/prop-firm`, `/dashboard/prop-firm/accounts` | `documented-external` | `/dashboard/accounts?filter=prop-firm` | Redirect pages `app/dashboard/prop-firm/page.tsx:6` (server `redirect`), `app/dashboard/prop-firm/accounts/page.tsx:12-13` (mount)`push`); referenced by `app/dashboard/hooks/use-keyboard-shortcuts.ts:42`, `app/dashboard/prop-firm/payouts/page.tsx:133` | `unavailable` | Required before removal (bookmarks/links documented in spec M3) | **Retained**; scanner reports both as redirect aliases pending approval |
| `/dashboard/prop-firm/accounts/[id]/trades/new` | `internal-only` | `/dashboard/trades/new?accountId=&propFirmAccountId=&phaseId=&origin=&returnTo=` | Migrated consumers via `buildTradeEntryHref`: `components/quick-add-fab.tsx`, `components/dashboard-shell-actions.tsx`, `app/dashboard/components/navbar.tsx`, `app/dashboard/components/empty-trade-state.tsx`, `app/dashboard/prop-firm/accounts/[id]/trades/page.tsx` | `unavailable` | Not required (internal-only, no external permalinks) | Route dir absent (`ls app/dashboard/prop-firm/accounts/[id]/trades/` shows only `loading.tsx`/`page.tsx`); `tests/ui/canonical-trade-entry-contracts.test.ts:13` asserts `statSync(...new...)` throws; scanner's `removedAliasHrefs` rejects re-introductions |
| `/dashboard/accounts/[id]/trades/new` | `internal-only` | `/dashboard/trades/new` (query context) | None (never shipped docs; routed through canonical `buildTradeEntryHref`) | `unavailable` | Not required | Route dir absent; same scanner guard as above |
| `/dashboard/trades/new` | canonical (retained) | itself | `buildTradeEntryHref` callers: `components/quick-add-fab.tsx`, `components/dashboard-shell-actions.tsx`, `app/dashboard/components/navbar.tsx`, `app/dashboard/components/empty-trade-state.tsx`, `app/dashboard/prop-firm/accounts/[id]/trades/page.tsx`; builder at `app/dashboard/trades/new/trade-entry-draft.ts` | `unavailable` | N/A (canonical) | Wire verified: `tests/ui/docs-link-scan.test.ts` + route scanner confirm `page.tsx`/`trade-entry-page-client.tsx`/`trade-entry-draft.ts` present |
| Obsolete modal trade entry | `internal-only` | `/dashboard/trades/new` (route replaces overlay) | No `createTradeWorkspace`/`trade-entry-modal` remnants in `app`/`components` | `unavailable` | Not required (internal) | Modal entry removed after canonical route shutdown |
| `[...not-found]` catch-all | `internal-only` (404 surface) | Retain (default next) | `app/[...not-found]/page.tsx` only | `unavailable` | N/A (retain) | `notFound()` invoked; scanner reports the unreachable markup after `notFound()` as removable |

`hostRewriteCallers`: none — `next.config.js`, `vercel.json` and `proxy.ts` define no rewrites or legacy hosts for these routes.

See the [August 2026 release notes](2026-08-ui-ux-refactor.md) for behavior changes and rollout guidance.
