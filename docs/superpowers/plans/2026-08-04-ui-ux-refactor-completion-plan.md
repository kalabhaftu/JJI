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

- [ ] Add failing tests for the narrow Tradovate session interface and remove obsolete split setters.
- [ ] Migrate critical notification, account-detail, trade, subscription, settings, synchronization, and import requests to the canonical API lifecycle.
- [ ] Complete the manual-trade validation state machine and remove duplicate validation ownership.
- [ ] Add the reusable unsaved-changes controller and migrate `TradeWorkspace` dirty-state ownership to it.
- [ ] Add `FreshnessState`, bounded visibility-aware degraded refresh, offline suppression, and stale-age exposure.
- [ ] Coalesce prop-firm realtime bursts into one in-flight request plus one pending follow-up.
- [ ] Add the dashboard initial loading boundary and route contract tests.
- [ ] Run every focused command listed by the authoritative tasks, then `bun run type-check`.
- [ ] Commit reviewable Phase 1 slices.

### Task 2: Complete Phase 2 Shared Primitive Contracts

**Authoritative tasks:** 2.1 through 2.6.

- [ ] Add focused financial-token invariance evidence.
- [ ] Remove duplicate mobile navigation path ownership and migrate remaining canonical route callers.
- [ ] Complete focused field wrappers, numeric parsing, error summary, and editable table field contracts.
- [ ] Remove ad hoc skeletons and add granular skeleton/loading contract tests.
- [ ] Extract standalone financial formatting and complete filter consumer migration.
- [ ] Complete the `RevealAction` label/icon/reveal-mode API and migrate callers.
- [ ] Remove legacy button aliases after all consumers use explicit semantics and enforce 44-pixel core targets.
- [ ] Run the authoritative focused commands and type-check.

### Task 3: Complete Canonical Workflows and Domain Ownership

**Authoritative tasks:** 3.1 through 5.16 and 7.1 through 7.5.

- [ ] Complete canonical trade review, route context validation, draft failure handling, and remove the obsolete account-specific trade-entry route after the evidence gate.
- [ ] Migrate accounts, prop-firm, payouts, auth, settings, feedback, and import forms to shared primitives and canonical request ownership.
- [ ] Migrate journal, trades, reports, tags, templates, notifications, playbook, backtests, synchronizations, settings, AI metadata, import/export, and account details to one scoped TanStack Query owner each.
- [ ] Remove production SWR ownership and obsolete module caches after focused domain tests pass.
- [ ] Route auth transitions through one cache coordinator and clear all private provider/module state.
- [ ] Add rollback-safe optimistic trade mutations with snapshots and targeted settle behavior.
- [ ] Remove legacy broad realtime invalidation and connect every mapped table to scoped invalidation.
- [ ] Replace the 100,000-row metrics request with bounded server aggregates and explicit data quality.
- [ ] Complete every route family state and interaction acceptance criterion in Phase 5.
- [ ] Run focused domain suites and type-check after each domain slice.

### Task 4: Complete Exact Route and Browser Evidence

**Authoritative tasks:** 0.2, 5.1 through 5.16, 6.1, and 6.2.

- [ ] Replace the family-level ledger with exact route/boundary/state/test/N/A evidence.
- [ ] Add direct `@axe-core/playwright` usage and deterministic authenticated, demo, visual, and reduced-motion fixtures.
- [ ] Add parameterized Phase 5 route-family suites without duplicate route tests.
- [ ] Add runtime axe, keyboard, touch, 44-pixel target, local overflow, sticky focus, dynamic viewport, skeleton preservation, reduced-motion, CLS, and 200-percent zoom checks.
- [ ] Cover the approved viewport, theme, accent, state, public, demo, and authenticated matrices.
- [ ] Run Chromium public/demo suites locally; run Firefox/WebKit critical suites after Chromium is stable.
- [ ] Record authenticated fixture limitations precisely when credentials or fixture IDs are unavailable.

### Task 5: Complete Route Gates, Validation, and Release Evidence

**Authoritative tasks:** 0.1 and 8.1 through 8.3.

- [ ] Record command, timestamp, exit status, and relevant output for the baseline and final validation suites.
- [ ] Expand route integrity checks to static, dynamic, canonical, obsolete, docs, redirect, and rewrite paths.
- [ ] Expand dead-code checks with explicit allowlists and remove unreachable catch-all markup.
- [ ] Complete the route-removal inventory schema and remove only routes whose evidence gate passes.
- [ ] Run every final command in Task 8.3 and record failures or environmental limitations honestly.
- [ ] Run the approved Impeccable detector exactly once after all UI changes and classify every finding.
- [ ] Update release evidence, exact route ledger, and the original August 3 plan checkboxes.
- [ ] Run final strict review and production build.
- [ ] Rebase onto the user's latest `preview`, resolve conflicts without discarding user edits, rerun final validation, and integrate into `preview` only.

## Completion Gate

- [ ] Every checkbox in the August 3 authoritative plan is checked and backed by evidence.
- [ ] Every checkbox in this addendum is checked.
- [ ] No active production SWR domain owner, duplicate module cache, legacy query key, broad private invalidation, obsolete internal route, compatibility button alias, or duplicate trade workspace remains.
- [ ] `main` has the same commit as before this completion effort.
- [ ] The rebased branch passes type-check, lint, Vitest, architecture/security checks, route/dead-code gates, production build, and available non-production Playwright suites.
