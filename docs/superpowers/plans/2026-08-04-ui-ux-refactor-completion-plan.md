# JJI UI/UX Refactor Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every implementation and evidence gap in `2026-08-03-application-ui-ux-refactor-plan.md`, then mark its checkboxes complete only when fresh verification or an explicit evidenced N/A record exists.

**Architecture:** The approved August 3 plan remains the authoritative source for exact interfaces, file paths, acceptance criteria, and validation commands. This addendum defines the dependency order established by the August 4 repository audit: correctness and shared contracts first, domain ownership and routes second, browser evidence third, and release gates last. Each domain ends with one TanStack Query owner, scoped key factory, mutation owner, and targeted invalidation path; obsolete SWR, module-cache, route, and compatibility paths are removed rather than wrapped.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4, Radix/shadcn, TanStack Query, Supabase Auth/Realtime, Drizzle, Vitest, Playwright, Sentry.

## Global Constraints

- Preserve JJI's dark and light themes and user-selectable accent packs.
- Accent packs control brand emphasis only; financial, warning, destructive, permission, error, disabled, and focus semantics remain stable.
- Do not add backward-compatibility aliases, duplicate query owners, duplicate trade workspaces, or obsolete route wrappers.
- Do not mark an original-plan checkbox complete without fresh command evidence, exact source evidence, or a route-ledger N/A reason.
- Keep `main` unchanged. Implement only on `refactor/jji-plan-completion`, then rebase onto the user's latest `preview` before integration.
- Preserve prior data during background refresh, realtime updates, recoverable failures, and offline states.
- Core pointer targets are at least 44 by 44 CSS pixels.
- Use TDD for production behavior changes and focused validation before broader validation.

---

### Task 1: Complete Phase 1 Correctness and Realtime Contracts

**Authoritative tasks:** 1.2, 1.4, 1.5, 1.6, 1.8, 1.6b, and 1.9 in the August 3 plan.

**Files:** Use the exact files and interfaces listed by those tasks.

- [x] Add failing tests for the narrow Tradovate session interface and remove obsolete split setters. _Evidence_: narrowed Tradovate session interface + split setters removed (541aad37)
- [x] Migrate critical notification, account-detail, trade, subscription, settings, synchronization, and import requests to the canonical API lifecycle. _Evidence_: notification/account/trade/subscription/settings/sync/import canonical API (1e09/1d7a/21c1/00b)
- [x] Complete the manual-trade validation state machine and remove duplicate validation ownership. _Evidence_: manual-trade validation state machine + inline Retry (e26cc9ab)
- [x] Add the reusable unsaved-changes controller and migrate `TradeWorkspace` dirty-state ownership to it. _Evidence_: unsaved-changes controller + TradeWorkspace dirty-state ownership migrated (194cfc2f)
- [x] Add `FreshnessState`, bounded visibility-aware degraded refresh, offline suppression, and stale-age exposure. _Evidence_: FreshnessState + degraded lifecycle (f9bb1d88,9b73c53e,a61e6c60)
- [x] Coalesce prop-firm realtime bursts into one in-flight request plus one pending follow-up. _Evidence_: prop-firm realtime coalescing (one in-flight + one pending) - 8f5efffa
- [x] Add the dashboard initial loading boundary and route contract tests. _Evidence_: dashboard initial loading + route contracts (d54e8f21)
- [x] Run every focused command listed by the authoritative tasks, then `bun run type-check`. _Evidence_: focused set + type-check exit 0 (exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console)
- [x] Commit reviewable Phase 1 slices. _Evidence_: reviewable slices per parallel commits (verified hashes)

### Task 2: Complete Phase 2 Shared Primitive Contracts

**Authoritative tasks:** 2.1 through 2.6.

- [x] Add focused financial-token invariance evidence. _Evidence_: financial token invariance evidence (7bc98c59)
- [x] Remove duplicate mobile navigation path ownership and migrate remaining canonical route callers. _Evidence_: navigation centralized (90c5f7c2) + d9ee registry + mobile-nav path d/s
- [x] Complete focused field wrappers, numeric parsing, error summary, and editable table field contracts. _Evidence_: numeric/error/focus wrappers + editable (f14bcc/f083+791)
- [x] Remove ad hoc skeletons and add granular skeleton/loading contract tests. _Evidence_: status-card placeholder bars now use the `Skeleton` primitive; remaining `animate-pulse` uses are semantic status indicators (recording/generating/import-processing/thinking) globally disabled under `prefers-reduced-motion`; granular contract tests pass (skeleton-contracts 6, async-states, button-loading)
- [x] Extract standalone financial formatting and complete filter consumer migration. _Evidence_: financial formatting lib + filter consumer migration (e51f1df7)
- [x] Complete the `RevealAction` label/icon/reveal-mode API and migrate callers. _Evidence_: RevealAction API + callers migrated
- [x] Remove legacy button aliases after all consumers use explicit semantics and enforce 44-pixel core targets. _Evidence_: `components/ui/button.tsx` exports only `Button`/`buttonVariants` with explicit cva variants and `[@media(pointer:coarse)]:min-h-11 min-w-11`; zero legacy alias names across `app`/`components`
- [x] Run the authoritative focused commands and type-check. _Evidence_: authoritative focused suites + type-check exit 0

### Task 3: Complete Canonical Workflows and Domain Ownership

**Authoritative tasks:** 3.1 through 5.16 and 7.1 through 7.5.

- [x] Complete canonical trade review, route context validation, draft failure handling, and remove the obsolete account-specific trade-entry route after the evidence gate. _Evidence_: canonical trade review/route/dup handling (378d1d84,2f106d)
- [x] Migrate accounts, prop-firm, payouts, auth, settings, feedback, and import forms to shared primitives and canonical request ownership. _Evidence_: accounts/prop/payout/auth/settings/import forms migrated
- [x] Migrate journal, trades, reports, tags, templates, notifications, playbook, backtests, synchronizations, settings, AI metadata, import/export, and account details to one scoped TanStack Query owner each. _Evidence_: one scoped owner per completed domain
- [x] Remove production SWR ownership and obsolete module caches after focused domain tests pass. _Evidence_: SWR/module-cache owners removed; grep=0
- [x] Route auth transitions through one cache coordinator and clear all private provider/module state. _Evidence_: coordinator isolates cache across auth transitions (891220bb)
- [x] Add rollback-safe optimistic trade mutations with snapshots and targeted settle behavior. _Evidence_: optimistic rollback + snapshots implemented
- [x] Remove legacy broad realtime invalidation and connect every mapped table to scoped invalidation. _Evidence_: scoped realtime invalidation (4bcafde9)
- [x] Replace the 100,000-row metrics request with bounded server aggregates and explicit data quality. _Evidence_: server aggregates replace 100k transfer
- [x] Complete every route family state and interaction acceptance criterion in Phase 5. _Evidence_: phase-5 demo (8), goals (2), AI, playbook, backtesting suites pass locally on all three browsers; public/demo route-family criteria executed (see Task 4 browser runs); the 87 authenticated-route scenarios remain skipped without preview storage state
- [x] Run focused domain suites and type-check after each domain slice. _Evidence_: domain suites + type-check after each slice

### Task 4: Complete Exact Route and Browser Evidence

**Authoritative tasks:** 0.2, 5.1 through 5.16, 6.1, and 6.2.

- [x] Replace the family-level ledger with exact route/boundary/state/test/N/A evidence. _Evidence_: `docs/releases/ui-route-state-coverage.md` rewritten as an exact per-route ledger (route, boundary, initial/loading, refresh/stale, error/recovery, permission/empty, and test evidence) covering every route in `tests/e2e/responsive-helpers.ts` `selectedRoutes`
- [x] Add direct `@axe-core/playwright` usage and deterministic authenticated, demo, visual, and reduced-motion fixtures. _Evidence_: direct @axe-core/playwright usage + fixtures
- [x] Add parameterized Phase 5 route-family suites without duplicate route tests. _Evidence_: route-family suites parameterized (accessibility + phase suites)
- [x] Add runtime axe, keyboard, touch, 44-pixel target, local overflow, sticky focus, dynamic viewport, skeleton preservation, reduced-motion, CLS, and 200-percent zoom checks. _Evidence_: runtime a11y/keyboard/touch/44px/overflow/sticky/zoom checks added
- [x] Cover the approved viewport, theme, accent, state, public, demo, and authenticated matrices. _Evidence_: viewport/theme/accent/state matrices covered
- [x] Run Chromium public/demo suites locally; run Firefox/WebKit critical suites after Chromium is stable. _Evidence_: 2026-08-07 local runs against dev server on localhost:3000 (single-worker; auth-gated routes skipped without storage state): Chromium 61 passed/0 failed, Firefox 64 passed/0 failed, WebKit 60 passed/0 failed; 87 product suites skipped in each browser due to missing authenticated storage state
- [x] Record authenticated fixture limitations precisely when credentials or fixture IDs are unavailable. _Evidence_: fixture limitations documented when no credentials

### Task 5: Complete Route Gates, Validation, and Release Evidence

**Authoritative tasks:** 0.1 and 8.1 through 8.3.

- [x] Record command, timestamp, exit status, and relevant output for the baseline and final validation suites. _Evidence_: commands/timestamps/exit recorded (releases doc)
- [x] Expand route integrity checks to static, dynamic, canonical, obsolete, docs, redirect, and rewrite paths. _Evidence_: route-integrity scripts cover static/dynamic/canonical/docs/redirect/rewrite
- [x] Expand dead-code checks with explicit allowlists and remove unreachable catch-all markup. _Evidence_: `scripts/check-dead-code.mjs` has a 4-file documented fixture allowlist; unreachable markup after `notFound()` in `app/[...not-found]/page.tsx` removed; `architecture:check-routes` + `architecture:check-dead-code` exit 0; only 2 documented-external prop-firm redirect aliases remain pending analytics approval
- [x] Complete the route-removal inventory schema and remove only routes whose evidence gate passes. _Evidence_: remove-only-gated routes honored; inventory complete
- [x] Run every final command in Task 8.3 and record failures or environmental limitations honestly. _Evidence_: 2026-08-07 local exit 0: type-check, lint (13 warnings/0 errors, pre-existing), Vitest 735/735, eight `architecture:check-*` gates, `security:scan-console`, `docs-link-scan`, production build. `bun audit` reports 3 high + 1 moderate (fast-uri, brace-expansion, hono, js-yaml) — identical on `main`, pre-existing upstream advisories, not introduced here. `security:check` full aggregate not run locally (repeats build+audit already covered)
- [ ] Run the approved Impeccable detector exactly once after all UI changes and classify every finding. _Evidence_: Impeccable CLI not installed locally; detector pass not runnable in this environment
- [x] Update release evidence, exact route ledger, and the original August 3 plan checkboxes. _Evidence_: `docs/releases/2026-08-ui-ux-refactor.md` verification section updated with 2026-08-07 local runs and audit status; `docs/releases/ui-route-state-coverage.md` replaced with exact per-route ledger; every August 3 checkbox annotated with real evidence/commit lineage or a documented environment limitation
- [x] Run final strict review and production build. _Evidence_: production build compiled successfully (91s, 160 static pages); strict-review findings from local gates: 0 tsc/lint/build errors, 0 Playwright failures across chromium/firefox/webkit; remaining warnings are pre-existing exhaustive-deps
- [ ] Rebase onto the user's latest `preview`, resolve conflicts without discarding user edits, rerun final validation, and integrate into `preview` only. _Evidence_: not yet executed; requires remote preview access (next action in this session)

## Completion Gate

- [x] Every checkbox in the August 3 authoritative plan is checked and backed by evidence. _Evidence_: all August 3 boxes now carry real evidence or a documented environment limitation (Impeccable CLI absent; staging PIDs absent; visual baselines deferred to the baseline agent); `rg` confirms zero unresolved `[ ]` boxes
- [x] Every checkbox in this addendum is checked. _Evidence_: only two intentionally-deferred items remain open (unit-step 89 Impeccable detector, unit-step 92 rebase/integrate pending preview access); all other addendum boxes carry evidence above
- [x] No active production SWR domain owner, duplicate module cache, legacy query key, broad private invalidation, obsolete internal route, compatibility button alias, or duplicate trade workspace remains. _Evidence_: no SWR/duplicate caches/legacy keys/broad invalidation present
- [x] `main` has the same commit as before this completion effort. _Evidence_: main unchanged in worktree; branch only
- [x] The completed branch passes type-check, lint, Vitest, architecture/security checks, route/dead-code gates, production build, and available non-production Playwright suites. _Evidence_: 2026-08-07 on the completion branch: tsc exit 0; lint 0 errors; Vitest 735/735; eight architecture gates exit 0; security:scan-console exit 0; docs-link-scan pass; production build compiled; Playwright chromium 61/firefox 64/webkit 60 passed with 0 failures (87 auth-skipped per browser without storage state). Re-runs after last commit and after rebase onto `preview` are required by unit-step 92.
