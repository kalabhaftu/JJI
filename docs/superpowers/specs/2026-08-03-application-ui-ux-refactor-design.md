# JJI Application UI/UX and Production-Readiness Refactor

Status: Proposed for user review  
Date: 2026-08-03  
Scope: Customer-facing `JJI` web application  
Approach: Correctness-first layered refactor  
Excluded: `JJI-admin`, `JJI-android`, and unrelated backend redesign

## 1. Purpose

This specification defines an application-wide UI, UX, accessibility, client-state, and production-readiness refactor for JJI. JJI is a trading journal and analytics platform used to enter and import trades, review execution, analyze performance, manage trading accounts and prop-firm evaluations, keep a journal, and understand synchronization and system state.

The refactor must make the product predictable, trustworthy, efficient, accessible, maintainable, and ready for production without replacing working architecture without evidence. Correctness, security, data integrity, and state reliability precede broad visual refactoring.

## 2. Approved Direction

The approved direction is Approach A: a correctness-first layered refactor.

The work will:

- preserve JJI's dark and light themes;
- preserve user-selectable accent packs as an intentional product feature;
- keep system semantic roles stable while accent packs drive brand roles and the win/loss financial pair;
- fix entitlement, browser credential storage, API handling, realtime lifecycle, request cancellation, stale-response, validation, and cache-isolation defects before broad page redesign;
- establish shared contracts for navigation, fields, buttons, async states, financial values, filters, dialogs, and trade workspaces;
- move trade entry to a canonical dedicated route with responsive workspace behavior, draft preservation, clear validation, and predictable browser-back behavior;
- migrate pages in complete workflows rather than applying isolated cosmetic changes;
- verify loading, empty, error, success, disabled, offline, stale, permission, and partial-data states;
- include accessibility in component architecture rather than treating it as final polish.

## 3. Product and User Model

### 3.1 Primary users

- Active discretionary traders reviewing recent execution and performance.
- Power users importing and filtering large trade histories.
- Prop-firm traders monitoring phase rules, drawdown, breaches, and payouts.
- New traders who need metric definitions and clear recovery guidance.
- Mobile users reviewing results or entering a trade while away from a desktop.
- Keyboard and assistive-technology users who need complete semantic interaction.

### 3.2 Primary jobs

- Understand current performance and account state quickly.
- Find, inspect, compare, edit, tag, and delete trades confidently.
- Enter or import trading data without losing work.
- Understand time zones, currency, fees, P&L, percentages, and calculation scope.
- Determine whether data is current, delayed, stale, estimated, incomplete, or unavailable.
- Diagnose an error and know what to do next.
- Move between overview, journal, reports, trades, accounts, and tools without losing context.

### 3.3 Experience principles

- Trust before decoration.
- Preserve context during asynchronous activity.
- One clearly dominant action per decision point.
- Domain-specific consistency rather than making unlike controls identical.
- Dense information must remain scannable, not merely compact.
- Financial meaning must never depend on color alone.
- Expert efficiency must not obscure first-time comprehension.
- Every recoverable failure must preserve user work and offer a next action.

## 4. Existing Architecture

### 4.1 Runtime and framework

- Next.js 16 App Router.
- React 19 and TypeScript.
- Tailwind CSS 4.
- shadcn-style source components backed by Radix UI.
- Supabase Auth, Postgres, Storage, and owner-scoped Realtime reads.
- Drizzle for application database access.
- TanStack Query, SWR, Zustand, React contexts, server bootstrap data, and module-level caches in the current client architecture.
- Sentry, Vercel Analytics, and Speed Insights.
- Vitest and Playwright.

### 4.2 Existing strengths to preserve

- Authenticated server layout and server-side subscription gate.
- Ownership predicates and RLS defense in depth.
- Shared UI primitives with visible focus foundations.
- Dashboard and demo shells that share substantial product UI.
- Mobile bottom navigation with canonical primary destinations.
- Error boundaries and centralized observability.
- Offline indicator and reconnect refetcher.
- Local scrolling for wide tables.
- Existing design tokens and dark/light theme support.
- Explicit demo fixtures and demo-isolation tests.
- Existing loading skeleton families and UI contract tests.

### 4.3 Refactoring constraints

- Keep Next.js, Tailwind, Radix, shadcn-style source components, Supabase, and Drizzle.
- Prefer dependencies already installed.
- Do not introduce a new state library.
- Do not replace simple fetch behavior with realtime unless realtime solves a demonstrated freshness need.
- Do not preserve obsolete internal paths by adding compatibility layers. Breaking route changes must be explicit and coordinated.
- Do not place sensitive provider credentials in persistent browser storage.
- Do not treat client capability flags as authorization.
- Keep changes phase-scoped and independently verifiable.

## 5. Application Inventory

### 5.1 Public product surfaces

- `/`
- `/about`
- `/contact`
- `/feedback`
- `/donate`
- `/changelog`
- `/privacy`
- `/terms`
- `/cookies`

Shared layout family:

- `components/layouts/public-layout.tsx`
- `components/layouts/public-shell.tsx`
- `components/layouts/public-header.tsx`
- `components/route-aware-footer.tsx`
- `components/footer.tsx`

Primary inventory issue: `/privacy` bypasses the shared public shell and therefore diverges in navigation, layout, signed-in action behavior, and visual treatment.

### 5.2 Authentication and access surfaces

- `/login`
- `/subscribe`
- `/subscribe/status`
- `/subscribe/success`
- `/subscribe/cancelled`

Authentication enters through `/login`; protected-route redirects preserve a local `next` path. The former visible `/app-launch` session bridge is retired in favor of the SSR cookie session flow, with `/api/auth/restore` retained only for silent recovery.

Primary components:

- `components/user-auth-form.tsx`
- `app/root-page-client.tsx`
- subscription clients and status cards
- subscription loading and error boundaries

### 5.3 Core authenticated surfaces

- `/dashboard`
- `/dashboard/journal`
- `/dashboard/reports`
- `/dashboard/table`
- `/dashboard/accounts`
- `/dashboard/accounts/[id]`
- `/dashboard/import`
- `/dashboard/data`
- `/dashboard/ai`
- `/dashboard/playbook`
- `/dashboard/backtesting`
- `/dashboard/goals`
- `/dashboard/settings`
- `/dashboard/trades/new` (new canonical route introduced by this refactor)

Authenticated shell family:

- `app/dashboard/layout.tsx`
- `app/dashboard/components/sidebar-layout.tsx`
- `app/dashboard/components/sidebar/dashboard-sidebar.tsx`
- dashboard navbar and filter components
- `components/ui/mobile-nav.tsx`
- `components/quick-add-fab.tsx`
- `components/command-palette.tsx`
- `components/dashboard-shell-actions.tsx`

### 5.4 Prop-firm surfaces

- `/dashboard/prop-firm`
- `/dashboard/prop-firm/accounts`
- `/dashboard/prop-firm/accounts/[id]`
- `/dashboard/prop-firm/accounts/[id]/trades`
- `/dashboard/prop-firm/accounts/[id]/trades/new`
- `/dashboard/prop-firm/accounts/[id]/settings`
- `/dashboard/prop-firm/accounts/[id]/payouts`
- `/dashboard/prop-firm/accounts/[id]/payouts/request`
- `/dashboard/prop-firm/payouts`
- `/dashboard/prop-firm/payouts/[id]`

Primary inventory issue: the domain has redirect aliases, parallel live/prop account component families, and duplicate account-detail concepts that can drift.

### 5.5 Demo surfaces

- `/demo`
- `/demo/journal`
- `/demo/reports`
- `/demo/table`
- `/demo/accounts`
- `/demo/accounts/[id]`
- `/demo/data`
- `/demo/ai`
- `/demo/playbook`
- `/demo/backtesting`
- `/demo/goals`
- `/demo/settings`
- `/demo/prop-firm/accounts/[id]`
- `/demo/prop-firm/accounts/[id]/settings`
- `/demo/prop-firm/accounts/[id]/payouts/request`

Primary inventory issue: production pages are reused efficiently, but direct `/dashboard` links and production assumptions can leak from reused pages into demo navigation.

### 5.6 Documentation surfaces

- `/docs`
- `/docs/getting-started`
- `/docs/faq`
- `/docs/feedback`
- `/docs/features/app-flow`
- `/docs/features/importing`
- `/docs/features/dashboard`
- `/docs/features/prop-firm`
- `/docs/features/journal`
- `/docs/features/trade-table`
- `/docs/features/accounts`
- `/docs/features/playbook`
- `/docs/features/backtesting`
- `/docs/features/ai-chat`
- `/docs/features/reports`
- `/docs/features/widgets`
- `/docs/features/notifications`
- `/docs/features/weekly-review`
- `/docs/features/goals`
- `/docs/features/demo`
- `/docs/features/data-management`
- `/docs/features/data-export`
- `/docs/features/settings`
- `/docs/features/shortcuts`
- `/docs/for-developers/tech-stack`
- `/docs/for-developers/frontend`
- `/docs/for-developers/backend`
- `/docs/for-developers/architecture`
- `/docs/for-developers/database`
- `/docs/for-developers/database-optimization`
- `/docs/for-developers/prisma-optimization`
- `/docs/for-developers/performance-baseline`

Primary inventory issue: docs navigation references `/docs/donate`, but the actual donation route is `/donate`.

### 5.7 Public shared-report surface

- `/reports/shared/[slug]`

Primary components:

- `app/reports/shared/[slug]/page.tsx`
- `app/reports/shared/[slug]/shared-report-view.tsx`

Primary inventory issue: the route lacks local loading/error contracts, uses broad snapshot typing, and silently ignores view-count failures.

### 5.8 Error and not-found surfaces

- `app/error.tsx`
- `app/global-error.tsx`
- `app/dashboard/error.tsx`
- `app/docs/error.tsx`
- `app/subscribe/error.tsx`
- `app/reports/error.tsx`
- `app/not-found.tsx`
- `app/[...not-found]/page.tsx`

Primary inventory issue: catch-all markup after `notFound()` is unreachable and creates ambiguity about the canonical 404 surface.

### 5.9 Shared component inventory

Primitive families:

- buttons and links;
- inputs, textareas, selects, checkboxes, switches, radio groups, sliders, OTP, file dropzone;
- forms and labels;
- cards, badges, alerts, separators, tables;
- dialogs, alert dialogs, sheets, popovers, dropdowns, tooltips, tabs, collapsibles;
- skeletons, spinners, progress, and shared async states;
- sidebar, mobile navigation, command palette, page header;
- custom date range picker;
- editor and AI prompt input.

Domain families:

- dashboard widgets and metric cards;
- report filters, navigation, charts, statements, and sharing;
- journal entries and trade cards;
- trade table, detail, edit, replay, import, and manual entry;
- account cards, account details, and account dialogs;
- prop-firm phases, account rules, trades, payouts, and approvals;
- playbooks, goals, backtests, notifications, AI workspace, and data management.

Consolidation candidates are defined in Section 10.

### 5.10 Route and state coverage matrix

Every route and route boundary is assigned to one of the following implementation tasks. A route family label is not sufficient coverage; the implementation checklist must record the exact path, owner, required states, responsive target, accessibility test, and completion evidence for every row.

| Route group | Exact route or boundary set | Owning phase/task | Required verification |
|---|---|---|---|
| Public | `/`, `/about`, `/contact`, `/feedback`, `/donate`, `/changelog`, `/privacy`, `/terms`, `/cookies` | Phase 5 public/support task | shell consistency, metadata, keyboard, mobile, empty/error form states |
| Authentication | `/login` | Phase 3 authentication task | keyboard, OTP errors, loading, recovery, mobile; protected-route `next` preservation |
| Subscription | `/subscribe`, `/subscribe/status`, `/subscribe/success`, `/subscribe/cancelled`, `/subscribe/loading`, `/subscribe/error` | Phase 3 subscription task | payment verification, timeout, retry, cancellation, loading/error |
| Dashboard | `/dashboard`, `/dashboard/loading` when added, `/dashboard/error` | Phase 1.6 and Phase 5.1 | page skeleton, granular widgets, partial failure, refresh preservation |
| Journal | `/dashboard/journal`, `/dashboard/journal/loading` | Phase 5.4 | notes, trade cards, autosave, offline, mobile, keyboard |
| Reports | `/dashboard/reports`, `/dashboard/reports/loading` | Phase 5.3 | filters, charts, metrics, stale/partial data, responsive tables |
| Trades | `/dashboard/table`, `/dashboard/table/loading` | Phase 5.2 | sorting, selection, bulk delete, workspace, mobile table |
| Canonical trade entry | `/dashboard/trades/new` | Phase 3.1 | draft, review, validation, browser back, mobile, keyboard |
| Live accounts | `/dashboard/accounts`, `/dashboard/accounts/loading`, `/dashboard/accounts/[id]`, `/dashboard/accounts/[id]/loading` | Phase 5.5 | account creation, detail, transient failure, mobile |
| Data and import | `/dashboard/import`, `/dashboard/data`, `/dashboard/data/loading` | Phase 5.7 | upload, progress, partial result, offline, export states |
| AI | `/dashboard/ai` | Phase 5.11 | consent, streaming, cancellation, rate limit, error recovery |
| Playbook | `/dashboard/playbook`, `/dashboard/playbook/loading` | Phase 5.8 | cards, editor, loading, empty, mobile |
| Backtesting | `/dashboard/backtesting`, `/dashboard/backtesting/loading` | Phase 5.10 | forms, long-running state, results, empty/error |
| Goals | `/dashboard/goals`, `/dashboard/goals/loading` | Phase 5.9 | forms, progress, empty, error, mobile |
| Settings | `/dashboard/settings`, `/dashboard/settings/loading` | Phase 5.12 | tabs, forms, save, unsaved, destructive actions |
| Prop-firm accounts | `/dashboard/prop-firm`, `/dashboard/prop-firm/accounts`, `/dashboard/prop-firm/accounts/[id]`, `/dashboard/prop-firm/accounts/[id]/loading` | Phase 5.6 | redirect disposition, phase state, permission, realtime |
| Prop-firm trades | `/dashboard/prop-firm/accounts/[id]/trades`, `/dashboard/prop-firm/accounts/[id]/trades/loading`, `/dashboard/prop-firm/accounts/[id]/trades/new`, `/dashboard/prop-firm/accounts/[id]/trades/new/loading` | Phase 3.1 and Phase 5.6 | entry context, filters, table, validation, mobile |
| Prop-firm settings | `/dashboard/prop-firm/accounts/[id]/settings`, `/dashboard/prop-firm/accounts/[id]/settings/loading` | Phase 3.2 and Phase 5.6 | rules, fields, responsive, save/error |
| Prop-firm payouts | `/dashboard/prop-firm/accounts/[id]/payouts`, `/dashboard/prop-firm/accounts/[id]/payouts/loading`, `/dashboard/prop-firm/accounts/[id]/payouts/request`, `/dashboard/prop-firm/accounts/[id]/payouts/request/loading`, `/dashboard/prop-firm/payouts`, `/dashboard/prop-firm/payouts/loading`, `/dashboard/prop-firm/payouts/[id]`, `/dashboard/prop-firm/payouts/[id]/loading` | Phase 3.2 and Phase 5.6 | eligibility, request, progress, error, destructive/financial semantics |
| Demo | Every route under `/demo`, including `/demo/layout` and all exact child pages listed in Section 5.5 | Phase 5.16 | no production escape, fixture states, route-aware navigation, mobile |
| Docs | Every route under `/docs`, including `/docs/layout`, `/docs/error`, and every exact page listed in Section 5.6 | Phase 5.14 | search, navigation, broken-link scan, keyboard, mobile |
| Shared reports | `/reports/shared/[slug]`, `/reports/error` and new local loading/error boundaries | Phase 5.15 | valid, expired, revoked, malformed, unavailable, loading, mobile |
| Global boundaries | `/error`, `/global-error`, `/not-found`, `/[...not-found]` | Phase 5.14 and Phase 8 | retry, back/home, 404 semantics, no unreachable markup |

For every matrix row, initial loading, local loading, background refresh, empty, no-results, success, disabled, offline, stale, permission-denied, partial-data, recoverable-error, and blocking-error behavior must be documented. A state may be marked N/A only with a written reason and test evidence that it cannot occur for that route or interaction.

## 6. Evidence-Backed Issue Register

Severity uses Critical, High, Medium, and Low. A finding is Critical when it creates an authorization, credential, data-integrity, or blocking production risk. High findings materially impede core workflows or violate important accessibility requirements. Medium findings create inconsistency or avoidable failure with a workaround. Low findings are maintenance or polish concerns.

### 6.1 Critical findings

#### C1. Client entitlement helper always grants access

- Evidence: `context/data-provider.tsx:549-551` returns `true` from `isPlusUser()`.
- Affected: any dashboard consumer relying on `isPlusUser()` for premium presentation or behavior.
- Impact: premium actions can appear available when they are not, creating misleading flows and a dangerous client authorization contract.
- Standard: UI capabilities derive from a typed server bootstrap result and remain presentation hints. Server routes enforce entitlement independently.
- Acceptance: free, active, expired, unavailable, and permission-denied states are tested; no hardcoded entitlement remains.

#### C2. Tradovate access and refresh tokens are persisted by Zustand

- Evidence: `store/tradovate-sync-store.ts:48-50` enables persistence; `store/tradovate-sync-store.ts:176-188` includes tokens in `partialize`.
- Affected: provider synchronization, logout, user switching, and browser persistence.
- Impact: credentials can survive browser restarts, remain after logout, and have an unnecessary same-origin exposure window.
- Standard: provider refresh credentials are server-owned. Browser state contains no persistent access or refresh token.
- Acceptance: local storage contains no provider credential, stale persisted keys are removed, and reconnect/logout behavior is tested.

### 6.2 High findings

#### H1. Realtime singleton can install a stale channel

- Evidence: `lib/realtime/database-realtime.ts:31-40`, `68-164`, and `223-226`.
- Impact: a connection started for an old session can complete after sign-out or user change and replace the current channel.
- Standard: realtime ownership is authenticated-session scoped and generation safe.
- Acceptance: stale connections cannot install; reconnect timers and channels are cancelled on auth transition.

#### H2. Realtime refresh cleanup captures initial timer values

- Evidence: `hooks/use-data-provider-realtime.ts:80-91` snapshots timer refs when the effect mounts.
- Impact: delayed refreshes can run after unmount or sign-out.
- Standard: cleanup reads and clears current refs and every timer created by the hook.
- Acceptance: timer tests prove no post-unmount refresh.

#### H3. Prop-firm realtime events are dropped during an active request

- Evidence: `hooks/use-prop-firm-realtime.ts:112-115` returns while fetching; events call fetch at `180-215`.
- Impact: final UI can remain stale after rapid account or trade events.
- Standard: coalesce events while busy and run one follow-up refresh.
- Acceptance: event bursts result in bounded requests and current final state.

#### H4. Account-detail requests lack cancellation and stale-response protection

- Evidence: `app/dashboard/accounts/[id]/page.tsx:195-224`; `hooks/use-prop-firm-realtime.ts:112-174`.
- Impact: an older response can overwrite newer route or account state; transient failures are conflated with not-found behavior.
- Standard: compose abort signals, use request identity, and classify 403, 404, offline, timeout, and 5xx states.
- Acceptance: route changes cannot display stale account results; recoverable failures remain in context with Retry.

#### H5. The canonical fetch helper overwrites caller cancellation

- Evidence: `lib/utils/fetch-with-error.ts:102-113` replaces any caller signal with its timeout signal.
- Impact: callers cannot cancel requests during navigation or superseding actions.
- Standard: caller and timeout signals are composed; deliberate cancellation is not reported as a timeout and is not retried.
- Acceptance: cancellation and timeout tests distinguish both cases.

#### H6. Multiple server-state systems create overlapping sources of truth

- Evidence: React Query in `hooks/use-filtered-trades.ts`; SWR in `hooks/use-journal.ts` and `hooks/use-accounts.ts`; module caches in `context/tags-provider.tsx` and `context/template-provider.tsx`; context/Zustand orchestration in `context/data-provider.tsx`.
- Impact: pages can disagree after mutation, realtime events, sign-out, or demo/auth transitions.
- Standard: TanStack Query owns authenticated server state by domain; Zustand owns local UI state; context composes providers; private module caches are removed or user-scoped.
- Acceptance: every domain documents one source of truth and one invalidation path.

#### H7. Optimistic trade updates have no snapshot rollback

- Evidence: `hooks/use-data-provider-trade-mutations.ts:43-71` and `122-146`.
- Impact: rejected changes can remain visible when refetch is delayed or fails.
- Standard: snapshot, cancel, patch, rollback, and settle, or use pessimistic mutation for the workflow.
- Acceptance: mutation failure restores the prior visible state.

#### H8. Realtime account update reads the wrong event field

- Evidence: normalized event uses `event` in `lib/realtime/database-realtime.ts:14-20`; account page checks `eventType` at `app/dashboard/accounts/page.tsx:193-201`.
- Impact: intended local updates do not run and broad refetches occur instead.
- Standard: typed discriminated realtime events with no `any` cast.
- Acceptance: INSERT, UPDATE, and DELETE consumer tests pass.

#### H9. Critical data can remain stale after realtime reconnect exhaustion

- Evidence: reconnect stops after five attempts at `lib/realtime/database-realtime.ts:205-212`; the reconnect refetcher only reacts to browser events at `components/reconnect-refetcher.tsx:17-39`.
- Impact: data can remain stale while the browser remains online and visible.
- Standard: expose degraded realtime state and activate bounded, visibility-aware refresh for critical data.
- Acceptance: degraded mode starts and stops predictably and communicates freshness.

#### H10. Manual trade phase validation fails open

- Evidence: empty nested catch in `app/dashboard/components/import/manual-trade-entry/manual-trade-form.tsx:301-319`.
- Impact: trade creation can continue when a safety or phase validation request fails.
- Standard: fail closed, preserve draft, show persistent contextual error, and support Retry.
- Acceptance: offline, timeout, malformed response, 403, and 5xx all prevent save without losing input.

#### H11. Major forms bypass accessible field relationships

- Evidence: manual trade fields at `manual-trade-form.tsx:401-784`; prop-firm fields at `create-prop-firm-dialog.tsx:306-719`; live-account fields at `create-live-account-dialog.tsx:225-357`.
- Impact: screen readers may not hear labels, descriptions, or errors; invalid submissions do not guide users to the source.
- Standard: stable control ID, associated label, description/error IDs, `aria-invalid`, alert behavior, and first-invalid focus.
- Acceptance: runtime tests verify names, descriptions, errors, and focus movement.

#### H12. Custom date range picker lacks calendar semantics

- Evidence: `components/ui/custom-date-range-picker.tsx:130-170` exposes day-number buttons without full-date names, selected state, grid semantics, or arrow navigation.
- Affected: global filters and reports.
- Standard: use installed `react-day-picker` or implement the complete WAI-ARIA date-picker pattern.
- Acceptance: keyboard day/month navigation, full-date announcements, selected range, and reduced-motion behavior pass.

#### H13. Full-screen trade surfaces are visual overlays, not dialogs

- Evidence: `global-trade-controller.tsx:39-59`, `trade-table.tsx:697-721`, `app/dashboard/table/page.tsx:126-146`.
- Impact: focus can reach the background; the workspace may not be announced; Escape and restoration are inconsistent.
- Standard: one route-aware trade workspace with dialog/sheet semantics, focus containment, Escape/back behavior, title, description, scroll lock, and unsaved-change interception.
- Acceptance: keyboard focus and browser-back tests pass.

#### H14. Progress does not forward its semantic value

- Evidence: `components/ui/progress.tsx:12-34` uses `value` for transform but does not pass it to the Radix root.
- Impact: screen readers cannot reliably announce determinate progress.
- Standard: forward value and require an accessible name.
- Acceptance: import, upload, restore, and prop-firm progress expose values.

#### H15. Docs navigation contains a broken destination

- Evidence: `app/docs/docs-layout-client.tsx:102-104` declares `/docs/donate`; actual route is `/donate`.
- Impact: sidebar and search can lead to 404.
- Standard: route registry and route-contract tests.
- Acceptance: donation destination resolves from docs and search.

#### H16. Dashboard root has a null suspense fallback

- Evidence: `app/dashboard/page.tsx:9-14` uses `fallback={null}`.
- Impact: the primary authenticated surface can appear blank during suspension.
- Standard: a page-structure skeleton for initial route load, followed by granular component loading.
- Acceptance: no blank dashboard state during initial load.

### 6.3 Medium findings

#### M1. Navigation is duplicated across surfaces

- Evidence: desktop sidebar, `lib/navigation/mobile-nav.ts`, `components/ui/mobile-nav.tsx`, and `components/dashboard-shell-actions.tsx` define destinations separately.
- Impact: route labels, access, and demo behavior can drift.
- Standard: one typed navigation registry generates each presentation.

#### M2. Demo-aware routing is bypassed by direct dashboard links

- Evidence: direct route literals in dashboard empty states, navbar, data, table, and prop-firm pages.
- Impact: reused demo pages can unexpectedly exit demo mode or require authentication.
- Standard: route creation uses a central surface-aware resolver.

#### M3. Prop-firm redirect aliases create avoidable transitions

- Evidence: server redirect at `app/dashboard/prop-firm/page.tsx`; client redirect/spinner at `app/dashboard/prop-firm/accounts/page.tsx`.
- Impact: inconsistent transition behavior and unnecessary navigation churn.
- Standard: one canonical account destination; obsolete aliases removed as a declared route change.

#### M4. Public legal and support pages use inconsistent shells

- Evidence: shared `PublicLayout` versus standalone privacy layout.
- Impact: legal pages look and behave like separate products.
- Standard: one public shell with route-specific metadata and content width.

#### M5. Filters mix immediate and staged application

- Evidence: `combined-filters.tsx:174-247` and `509-556`.
- Impact: users cannot predict when data updates, a popover closes, or Apply is required.
- Standard: one application model per filter surface.

#### M6. Hover-only actions are invisible during keyboard or touch use

- Evidence: account, upload, journal, backtest, and template actions use `opacity-0` without complete focus/coarse-pointer handling.
- Standard: visible on focus and coarse pointer, with no transparent focus target.

#### M7. Filter removal uses clickable SVGs

- Evidence: `app/dashboard/data/components/data-management/trade-table.tsx:465-484`.
- Standard: semantic removable chip button with an accessible outcome label.

#### M8. Table selection and sorting state is incomplete

- Evidence: `trade-table.tsx:490-596`.
- Standard: row-specific labels, `aria-sort`, result announcements, and confirmed bulk deletion.

#### M9. Mutation workflows are not consistently offline-aware

- Evidence: global offline indicator exists, but forms remain network-enabled and only discover failure after submission.
- Standard: disable with reason or explicitly queue; preserve drafts; distinguish cached and current data.

#### M10. Dense forms retain fixed multi-column layouts on mobile

- Evidence: `manual-trade-form.tsx:525-686`; `create-prop-firm-dialog.tsx:319-688`.
- Standard: one-column base, responsive expansion, sticky actions, and no clipped controls at 320px.

#### M11. Operational text falls below the documented floor

- Evidence: report filters, commission analysis, account metadata, and trade edit labels use 8-11px utilities.
- Standard: operational text is at least 12px; density comes from hierarchy and spacing.

#### M12. OTP failure relies on transient or motion-based feedback

- Evidence: `components/user-auth-form.tsx:110-145` and `318-345`.
- Standard: persistent linked error, assertive announcement, focus restoration, and intentional resend state.

#### M13. Settings tab orientation conflicts with mobile layout

- Evidence: `settings-navigation.tsx:9-20` declares vertical orientation while the layout becomes horizontally scrollable.
- Standard: visual and keyboard orientation match at each breakpoint.

#### M14. Nested interactive elements occur in subscription settings

- Evidence: `settings-profile-section.tsx:267-274` wraps a button with a link.
- Standard: `Button asChild` with one interactive element.

#### M15. Notification mutations can show success for HTTP failures

- Evidence: `notification-center.tsx:244-329` updates local state after fetch without checking `response.ok`.
- Standard: canonical response validation before local updates.

#### M16. Global private-data caches are not user scoped

- Evidence: tags and template module caches are not keyed by authenticated user.
- Standard: query cache or explicit user/session key and auth-transition cleanup.

#### M17. Metrics query can request up to 100,000 records

- Evidence: `context/data-provider.tsx:435-452` creates separate table and metrics queries.
- Standard: bounded paginated rows and a server aggregate endpoint.

#### M18. Shared report has weak snapshot and route-state contracts

- Evidence: `report as any`, `snapshot: any`, missing route-local loading/error boundaries, and silent view-count failure.
- Standard: validated snapshot schema and explicit unavailable, expired, malformed, loading, and error states.

### 6.4 Low findings

- Catch-all route contains unreachable fallback markup after `notFound()`.
- Docs search uses `window.location.href` instead of client navigation.
- Loading-boundary coverage is inconsistent for dashboard, import, AI, and redirect-only routes.
- Shared-report styling uses isolated hardcoded colors rather than an intentional token contract.
- `useAccounts` contains unused subscriber infrastructure.
- Some persisted settings keys are not user scoped.
- Integration preference state can outlive the authenticated session.

## 7. Design-System Direction

### 7.1 Product character

JJI is an operational trading review workspace. It should feel calm under repeated use, precise under financial scrutiny, and fast under expert workflows. The interface may be dense, but hierarchy and state must remain unmistakable.

The current `DESIGN.md` will be rewritten during Phase 2 to document the final token and component contracts established here. The application implementation remains the incumbent visual authority until that migration is verified.

### 7.2 Theme and accent packs

The theme system retains:

- dark mode;
- light mode;
- user-selectable accent packs;
- preference persistence;
- accent previews where already offered.

Accent packs may control:

- primary brand action color;
- active navigation emphasis;
- selected control emphasis;
- nonsemantic chart series accents;
- decorative brand emphasis.

Accent packs must not redefine:

- profit and loss;
- bullish and bearish price movement;
- long and short position meaning;
- success, warning, destructive, permission, and error states;
- disabled and read-only state;
- focus visibility.

Stable semantic roles require light and dark token pairs with WCAG AA contrast. Financial states use color plus sign, label, icon, stroke pattern, or explicit status text.

### 7.3 Surface hierarchy

Four surface levels replace arbitrary card styling:

1. Canvas: route background and lowest elevation.
2. Raised: primary content panels, forms, tables, and analysis sections.
3. Inset: filters, secondary control groups, and contextual metric detail.
4. Overlay: dialogs, sheets, popovers, menus, and command surfaces.

Cards exist only where grouping or elevation communicates structure. Nested decorative cards are replaced with section spacing, dividers, inset regions, or table structure.

### 7.4 Shape and spacing

- Base spacing unit: 4px.
- Operational controls: 8px radius.
- Primary panels and dialogs: 12px radius.
- Pills: statuses, tags, and compact filters only.
- Touch targets: at least 44 by 44 CSS pixels where pointer interaction is primary.
- Dense table rows may be shorter only when the actionable hit area remains accessible.

### 7.5 Typography and numerical data

- Preserve DM Sans unless later measured evidence justifies a change.
- Page title: 30-36px, semibold.
- Section title: 18-24px, semibold.
- Body: 14-16px.
- Operational label: 12-14px, medium or semibold.
- No operational text below 12px.
- Financial values use tabular figures.
- P&L values include explicit `+`, `-`, or neutral state.
- Currency always displays its currency context when account context is ambiguous.
- Percentage, points, ticks, quantity, fees, and risk values include unit semantics.

### 7.6 Iconography

- Preserve the installed Lucide icon system for implementation consistency.
- Standardize stroke, size, optical alignment, and placement through primitives.
- Icon-only controls require accessible outcome names and tooltips where the action is not obvious.
- Do not use icon color as the only state indicator.

### 7.7 Button hierarchy

Variants:

- Primary: one dominant page or workflow action.
- Secondary: important alternative that does not compete with primary.
- Tertiary/ghost: low-emphasis utility.
- Destructive: irreversible or materially harmful action.
- Link: navigation embedded in prose or compact utility.
- Icon-only: named action with tooltip when needed.
- Toolbar: compact repeated utility within tables and analysis controls.
- Table-row: contextual row action that remains visible on focus and touch.

Rules:

- Use outcome-specific labels such as `Save trade`, `Import 24 trades`, or `Delete account`.
- Loading state preserves button dimensions, disables duplicate submission, and sets `aria-busy`.
- Disabled state exposes a reason when the reason is not obvious.
- Destructive actions require consequence-focused confirmation.
- A page does not present several equal-looking primary actions without a justified workflow.

### 7.8 Field and form contracts

Every field includes, when applicable:

- stable ID;
- associated label;
- optional or required indicator;
- concise supporting description;
- prefix, suffix, currency, percentage, unit, date, time, and time-zone context;
- correct input type, input mode, autocomplete, and autofill behavior;
- validation message linked by `aria-describedby`;
- `aria-invalid` and a visible invalid state;
- disabled and read-only distinction;
- copy/paste-safe parsing;
- reset or clear behavior;
- preserved value after recoverable failure.

Form submission:

- validates at a timing appropriate to the field;
- focuses the first invalid field after failed submission;
- provides a persistent summary for long forms;
- prevents duplicate submission;
- preserves draft data;
- reports what failed, likely cause, and next action;
- does not rely only on toast feedback.

### 7.9 Financial value contract

A shared financial-value primitive formats:

- currency;
- P&L;
- percentage;
- points and ticks;
- fees and commission;
- drawdown;
- risk/reward;
- unavailable, estimated, delayed, incomplete, and stale states.

The primitive supports:

- locale-aware formatting;
- explicit sign;
- tabular figures;
- semantic label or accessible description;
- stable profit/loss tokens unaffected by accent packs;
- optional comparison period and metric-definition affordance.

### 7.10 Filter contract

Each filter surface chooses one model:

- immediate application, with no redundant Apply button; or
- staged draft, with explicit Apply and Cancel and no immediate data mutation.

All filter systems provide:

- visible active state;
- clear individual filter;
- Clear all;
- semantic removable chips;
- URL state when filters define a shareable or navigable analytical context;
- preserved state through browser back/forward;
- result count announcement;
- no-results state distinct from first-time empty state;
- explicit date range and time-zone scope.

### 7.11 Dialog and workspace contract

Dialogs, sheets, and route workspaces provide:

- accessible title and description;
- focus containment and restoration;
- Escape behavior;
- browser-back behavior when URL-backed;
- scroll locking;
- mobile sizing;
- sticky action footer for long workflows;
- unsaved-change interception;
- explicit cancel and outcome labels;
- no background interaction while modal.

## 8. Async and Loading-State Architecture

Skeletons represent genuinely missing content, not ordinary background activity.

### 8.1 Distinct async states

The design and data layer treat these as separate states:

- initial route loading;
- local component loading with no usable data;
- background refreshing;
- realtime update in progress;
- stale data;
- offline cached data;
- partial data;
- permission denied;
- recoverable error with previous data;
- blocking error without usable data;
- long-running import, export, synchronization, or generation progress.

### 8.2 Initial route loading

- Use page-structure skeletons that match the eventual page topology.
- Preserve the global shell, navigation, page context, and stable chrome.
- Avoid a blank main region.
- Skeleton geometry must reserve final dimensions and avoid layout shift.
- Skeleton animation respects reduced-motion preference.
- Dashboard route skeletons must compose the existing dashboard skeleton family rather than introducing route-local copies.
- Non-dashboard route and section skeletons must use shared primitives from `components/ui/non-dashboard-skeletons.tsx` in accordance with `docs/skeleton-guardrails.md`.
- New one-off `animate-pulse` skeleton markup is prohibited outside the existing approved skeleton/chart/widget infrastructure.

### 8.3 Local component loading

- Use a component-matching skeleton only when that component has no usable data yet.
- Do not replace sibling components or the entire page.
- Charts, tables, metric groups, and forms use local loading boundaries.
- A component that can render stable labels or structure before values arrive should preserve that structure.

### 8.4 Background refreshing

- Preserve the last valid content.
- Do not replace existing values with skeletons during routine refetch.
- Use a subtle updating indicator, timestamp, progress state, or concise accessible status where useful.
- Apply brief change highlighting only when it improves comprehension and respect reduced motion.
- Keep interactions available unless the operation creates a data-integrity conflict.

### 8.5 Realtime updates

- Update only affected values or queries.
- Coalesce rapid events and prevent request storms.
- Do not skeletonize cards, tables, or pages for every event.
- Announce material state changes politely when focus is elsewhere.
- Display freshness or synchronization status for data where timing matters.

### 8.6 Filter and date-context changes

- When a filter or date range changes the full analytical context, preserve the prior content with localized pending treatment unless retaining it could misrepresent the selected context.
- If retained values could be mistaken for the new context, visibly mark the region as updating and prevent comparison until current values arrive.
- Keep dimensions stable and avoid page-wide flicker.

### 8.7 Refresh failure with previous data

- Preserve the last successful data.
- Show its age or last-updated timestamp.
- Explain that refresh failed and whether data may be stale.
- Provide Retry.
- Do not collapse the page into a generic error state while valid prior data exists.

### 8.8 Offline data

- Label cached data as offline and show last successful synchronization time.
- Disable network-only actions with an explanation or explicitly queue supported actions.
- Preserve drafts and local navigation.
- Reconnection communicates refresh progress and completion.

### 8.9 Long-running operations

- Imports, exports, broker sync, backup restore, and report generation use determinate progress when measurable.
- Progress has an accessible name and semantic value.
- Partial success reports imported, skipped, duplicate, and failed counts.
- Cancellation is offered only when technically safe and accurately supported.

### 8.10 Loading acceptance criteria

- No unaffected page content visually blanks, resets, or rerenders as a skeleton during localized loading.
- No routine realtime event causes a full-page skeleton.
- Background refresh retains last valid content.
- Refresh failure retains prior content with age, failure, and Retry.
- Initial route loading uses a page-matching skeleton.
- Local missing data uses a local matching skeleton.
- Skeleton animation and change highlights respect reduced motion.
- Layout shift and repeated flicker are absent in automated visual checks and manual verification.
- New non-dashboard skeleton work passes the repository quick check from `docs/skeleton-guardrails.md`.

## 9. Canonical Trade-Entry Workspace

### 9.1 Route and navigation

The canonical manual trade route is `/dashboard/trades/new`. This route is fixed for this refactor and is a first-class route rather than an implementation-only modal.

Quick Add, command-palette actions, empty states, trade-table actions, and relevant account actions resolve through `/dashboard/trades/new`. The existing account-specific route `/dashboard/prop-firm/accounts/[id]/trades/new` remains only until its account and phase context can be represented by validated route state on the canonical route. Its final disposition follows the route-removal gate in Section 21.2. The obsolete modal-only entry path is removed after the canonical route is verified.

### 9.2 Responsive behavior

- Desktop: full-width operational workspace within the authenticated shell, with a constrained form column and persistent review/context panel where space permits.
- Tablet: single main form with summarized context and sticky actions.
- Mobile: full-screen route, one-column fields, thumb-reachable sticky action footer, and no narrow fixed grids.

### 9.3 Workflow sections

1. Account and instrument.
2. Position direction and quantity.
3. Entry and exit execution.
4. Date, time, and time zone.
5. Risk, stop, target, MAE, and MFE.
6. Fees and commissions.
7. Tags and playbook.
8. Notes and screenshots.
9. Review and save.

Sections use progressive disclosure where fields are optional or instrument-specific. The form must not require the user to remember data from a prior screen without visible context.

### 9.4 Draft preservation

- Store an explicit user- and draft-scoped local draft containing no secrets.
- Persist intentional form state across recoverable errors, route interruptions, and mobile app switching.
- Clear draft only after confirmed save or explicit discard.
- Warn before leaving with unsaved changes.
- Browser back first respects dirty-state handling, then returns to the originating context.

### 9.5 Validation

- Client validation provides fast field feedback.
- Server validation remains authoritative.
- Prop-firm phase validation fails closed.
- Time-zone and date ordering are explicit.
- Numeric parsing handles paste, locale separators, signs, decimals, and empty optional values.
- The review step shows normalized values before saving.

### 9.6 Submission states

- `Save trade` is the primary action.
- Duplicate submission is prevented.
- Blocking validation is inline and focuses the first invalid field.
- Network/server failure preserves all data.
- Success confirms the saved trade and offers `View trade` and return-to-origin behavior.
- Duplicate detection and partial import are explicit rather than silently merged.

## 10. Component Architecture

### 10.1 Components to consolidate or introduce

#### Navigation registry

Owns label, icon, canonical path, active matching, surface-aware path creation, mobile priority, command-palette inclusion, and capability requirements.

Consumers:

- desktop sidebar;
- mobile primary navigation;
- mobile More menu;
- command palette;
- breadcrumbs and page context;
- empty-state actions;
- demo routes.

#### Field primitives

Build on the existing form infrastructure and add domain wrappers only where behavior repeats:

- controlled select field;
- currency field;
- percentage field;
- date/time/time-zone group;
- symbol combobox;
- tag and multi-select field;
- editable table field.

Avoid a single excessively generic field with unrelated props.

#### Async state family

Evolve `components/ui/states.tsx` into composable states for:

- page initial loading;
- local loading;
- empty;
- no results;
- inline error;
- permission denied;
- offline/stale;
- partial success;
- retry.

#### Financial value

Domain-specific formatting and semantic display for financial numbers.

#### Date-range filter

Consolidates date presets, accessible calendar range selection, staged/immediate behavior, selected summary, clear behavior, and timezone scope.

#### Removable filter chip

Semantic remove button with an accessible outcome label.

#### Trade workspace

One details/edit workspace replaces custom overlays in the global controller, data table, and trade table route.

#### Responsive workflow shell

Shared layout for long account, prop-firm, import, and settings workflows. It owns responsive body, sticky footer, title/description, and dirty-state behavior without owning domain fields.

#### Reveal action

Shared visibility behavior for hover/focus/touch contextual actions.

### 10.2 Components to simplify or remove

- Remove unreachable catch-all fallback markup.
- Remove unused `useAccounts` subscriber infrastructure.
- Remove duplicate prop-firm redirect route behavior after canonical route migration.
- Remove one-off clickable SVG controls.
- Remove custom trade overlay wrappers after `TradeWorkspace` migration.
- Remove module-level private-data caches after query migration or explicitly scope them by user/session.
- Remove redundant filter Apply controls when immediate application is selected.

### 10.3 Components to keep domain specific

- Trade replay.
- Prop-firm phase progression and breach states.
- Payout request and payout status.
- Playbook model editor.
- Backtesting session and result views.
- AI conversation and review workspace.

These should compose shared primitives but should not be flattened into generic components with unclear responsibilities.

## 11. Client-State and Data Architecture

### 11.1 Target ownership

- TanStack Query: authenticated server state and mutations.
- Zustand: local UI state and non-sensitive persisted preferences.
- Context: provider composition, stable service access, and derived view state that cannot be expressed locally.
- URL: navigable filters, date ranges, selected tabs, and route-backed workspace state where appropriate.
- Server components/layouts: authentication, bootstrap, entitlement, and initial data where beneficial.

### 11.2 API client

The canonical API client must provide:

- typed success/error envelopes;
- request ID preservation;
- caller and timeout signal composition;
- cancellation classification;
- retry limits based on operation safety;
- consistent 401, 403, 404, 409, 422, 429, timeout, offline, and 5xx behavior;
- safe observability reporting;
- no automatic retry of non-idempotent mutations unless idempotency is guaranteed.

### 11.3 Query keys and cache isolation

Query keys include the domain inputs needed to make cached data correct, including user/session or surface identity when required. Demo and authenticated data can never share a private-data cache entry.

Auth transitions clear:

- React Query private data;
- SWR private data during migration;
- user-scoped persisted UI state where appropriate;
- private module caches before removal;
- provider integration session state.

### 11.4 Realtime

Realtime is used only for domains where server-side changes need timely client reflection, including notifications, account/trade updates, and synchronization status.

The realtime layer provides:

- one owner per authenticated session;
- generation-safe connect/disconnect;
- typed table/event payloads;
- bounded reconnect with status;
- event coalescing;
- targeted invalidation;
- visibility-aware degraded refresh after reconnect exhaustion;
- cleanup for channels, timers, and pending work.

### 11.5 Optimistic updates

Use optimistic updates only when they improve a frequent workflow and rollback is reliable. Required lifecycle:

1. Cancel conflicting reads.
2. Snapshot prior data.
3. Apply the minimal patch.
4. Roll back on error.
5. Reconcile with server response.
6. Invalidate targeted queries on settlement.

Use pessimistic updates for destructive, entitlement-sensitive, phase-sensitive, or rarely performed operations.

### 11.6 Metrics and large datasets

- Trade rows are paginated or virtualized as appropriate.
- Dashboard/report metrics use server aggregates instead of transferring large record sets solely for calculation.
- The UI exposes calculation scope, date range, included accounts, currency behavior, fees, and data completeness.
- Partial aggregate failures preserve unaffected metrics and disclose missing sections.

## 12. Navigation and Information Architecture

### 12.1 Canonical destinations

- Overview
- Journal
- Reports
- Trades
- Accounts
- Playbook
- Backtesting
- Goals
- Assistant
- Data
- Settings

Mobile primary navigation remains:

- Overview
- Journal
- Trades
- Reports
- More

### 12.2 Location and context

- Every route has one page title.
- Detail and workflow routes expose a clear route back to their originating list or account context.
- Breadcrumbs appear where hierarchy is more than one meaningful level and back context is not obvious.
- Selected tab and filter state are represented in URL when browser navigation and deep linking benefit.
- Browser back returns to the prior filter, page, and scroll context when feasible.

### 12.3 Route cleanup

- Fix docs donation route.
- Consolidate prop-firm account destinations around canonical accounts filtering and detail routes.
- Replace client-only redirect spinners with canonical links/routes.
- Ensure demo-aware paths are generated centrally.
- Declare route removals and update internal links/tests/docs in one phase.

## 13. Page-Level Design Requirements

### 13.1 Dashboard overview

- Page-structure initial skeleton instead of null fallback.
- Stable KPI and widget layout.
- Granular widget loading and partial failure.
- Background refresh preserves values.
- Account/date/filter context remains visible.
- Data freshness and incomplete-data state are explicit.

### 13.2 Trades

- Scannable table with stable columns, sorting semantics, row selection labels, and local overflow.
- Saved or URL-backed filter context where justified.
- Accessible trade details/edit workspace.
- Confirmed bulk deletion.
- P&L, direction, fees, and status never rely on color alone.
- Mobile uses an intentional compact list or priority-column table rather than squeezed desktop content.

### 13.3 Reports

- Clear date/account/filter scope.
- Metric definitions available without leaving context.
- Chart axes, units, legends, comparison basis, and unavailable/incomplete data are explicit.
- Granular chart and metric loading.
- Prior content remains during refresh.
- Sharing has clear visibility, expiry, and revocation behavior.

### 13.4 Journal

- Date and account context are stable.
- Trade cards expose actions on focus and touch.
- Empty day, no filtered trades, note loading, note saving, autosave failure, and offline states are distinct.
- Notes preserve user input during failure.

### 13.5 Accounts

- Live and prop-firm account cards share common account-summary structure where domain semantics match.
- Detail pages share page hierarchy, loading, error, back context, and action placement.
- Domain-specific phase/rule content remains separate.
- Transient fetch failure does not masquerade as not found.

### 13.6 Import and data management

- Import source, accepted format, limits, and privacy are explained before upload.
- File validation is inline and preserves valid files.
- Progress is determinate when possible.
- Duplicate, skipped, failed, and imported records are summarized.
- Cancellation and retry behavior reflect backend capability.
- Export generation distinguishes queued, processing, ready, expired, and failed states.

### 13.7 Prop firm

- Rule fields include units and definitions.
- Phase and breach status use text and symbols in addition to color.
- Current versus maximum drawdown is explicit.
- Payout eligibility, requested amount, fees, status, and next action are clear.
- Phase validation failures preserve trade entry data and fail closed.

### 13.8 Settings

- Navigation orientation matches layout.
- Save state is local to the changed section.
- Unsaved changes and autosave behavior are explicit.
- Integration credentials and connection state are not exposed unnecessarily.
- Destructive account/data actions have consequence-focused confirmation.

### 13.9 Authentication and subscription

- OTP errors are persistent, associated, announced, and focus the OTP control.
- Resend state is accurate after changing email.
- Provider-specific loading does not disable unrelated recovery without reason.
- Subscription polling exposes verification, delay, timeout, retry, and support paths.

### 13.10 AI workspace

- Consent and data-use boundaries remain explicit.
- Streaming, generating, cancelled, rate-limited, unavailable, and failed states are distinct.
- Conversation content remains stable during background state checks.
- Errors are persistent when user action is required.

### 13.11 Public, legal, and shared reports

- Public pages share shell and navigation conventions.
- Shared reports remain readable without authentication.
- Shared report state distinguishes expired, revoked, unavailable, malformed, and temporarily failed.
- Report snapshot is schema validated.
- Shared report styling follows an intentional theme contract.

### 13.12 Demo

- Reused production pages remain surface aware.
- No production API or authenticated route is reached from demo actions.
- Unsupported actions explain demo limitations rather than failing silently.
- Demo data is clearly presented as sample data without contaminating production query caches.

## 14. Content and Microcopy Standards

- Use sentence case.
- Use trader-recognizable terms, with contextual definitions for less obvious metrics.
- Replace vague actions with outcomes.
- Error messages state what happened, why it may have happened, and what the user can do next.
- Avoid `Something went wrong` when a classified error exists.
- Avoid congratulatory punctuation in routine success messages.
- Permission errors explain required access or recovery.
- Empty states distinguish first use, no data in range, no search results, and missing permissions.
- Destructive confirmations name the object and consequence.
- Metric tooltips state formula, scope, currency treatment, fees, and exclusions where relevant.

## 15. Accessibility and Responsive Requirements

### 15.1 Accessibility

- WCAG 2.2 AA target.
- Complete keyboard operation for core workflows.
- Visible focus indicators.
- Logical heading hierarchy and landmarks.
- Programmatic labels, descriptions, and errors.
- Dialog focus containment and restoration.
- Polite announcements for background status; assertive announcements for blocking errors.
- No financial or system meaning conveyed by color alone.
- Reduced-motion alternatives preserve state comprehension.
- Charts provide textual summaries or equivalent data access.
- Loading, stale, offline, and error states are announced appropriately without repeated noise.

### 15.2 Responsive behavior

Required verification widths:

- 320px;
- 375px;
- 768px;
- 1024px;
- 1280px;
- wide desktop.

Requirements:

- No global horizontal overflow.
- Wide tables and charts own local overflow.
- Forms use one-column mobile bases.
- Sticky elements do not obscure focused controls.
- Dialogs and sheets fit dynamic mobile viewport height.
- Touch targets meet minimum size.
- Text remains usable at 200% zoom.
- Charts maintain readable labels and interaction targets.
- Mobile actions remain thumb reachable.

Required route-family coverage is the full route/state matrix in Section 5.10. At minimum, responsive verification must include one exact route from each row plus every route containing a form, table, dialog, chart, upload, or long-running operation. The selected routes are: `/`, `/login`, `/subscribe/status`, `/dashboard`, `/dashboard/journal`, `/dashboard/reports`, `/dashboard/table`, `/dashboard/trades/new`, `/dashboard/accounts`, `/dashboard/accounts/[id]`, `/dashboard/import`, `/dashboard/data`, `/dashboard/ai`, `/dashboard/playbook`, `/dashboard/backtesting`, `/dashboard/goals`, `/dashboard/settings`, `/dashboard/prop-firm/accounts/[id]`, `/dashboard/prop-firm/accounts/[id]/trades`, `/dashboard/prop-firm/accounts/[id]/settings`, `/dashboard/prop-firm/accounts/[id]/payouts/request`, `/docs`, `/reports/shared/[slug]`, `/demo`, and `/not-found`.

## 16. Technical Production-Readiness Requirements

- No hardcoded entitlement result.
- No provider refresh token in persistent browser storage.
- No sensitive client-only authorization.
- No unbounded or infinite retries.
- No silent HTTP failure treated as success.
- No stale response can overwrite current route state.
- Timers, subscriptions, and channels clean up.
- Direct API calls use the canonical client or a documented protocol-specific adapter.
- Private caches are user and surface scoped.
- Demo and authenticated data cannot share private cache entries.
- Server aggregation replaces excessive client record transfer.
- Errors reach the central scrubbed observability path.
- Request IDs remain available for support diagnostics.
- No debug logs, dead interaction code, broken links, or placeholder production behavior.
- Critical flows have runtime tests, not source-string contracts alone.

## 17. Testing and Verification Strategy

### 17.1 Component tests

- Button hierarchy, loading, disabled, and destructive variants.
- Field labels, descriptions, errors, required/optional, disabled, and read-only states.
- Financial value formatting and semantic labels.
- Date range keyboard behavior.
- Async state variants.
- Progress value semantics.
- Removable filter chips.
- Trade workspace focus and dirty-state behavior.

### 17.2 Data and state tests

- Entitlement states.
- Auth user-switch cache cleanup.
- Provider credential persistence cleanup.
- API cancellation versus timeout.
- Stale-response suppression.
- Realtime session replacement.
- Reconnect exhaustion and degraded mode.
- Event coalescing.
- Timer cleanup.
- Optimistic rollback.
- Notification HTTP failure.
- Demo/auth cache isolation.

### 17.3 Critical user-flow tests

- Sign in.
- OTP failure and retry.
- Navigate dashboard.
- View performance metrics.
- Apply and clear filters.
- Use browser back/forward with analytical state.
- View a trade.
- Add a trade.
- Resume a trade draft.
- Edit a trade.
- Delete a trade.
- Bulk-delete trades.
- Import trades.
- Handle duplicate and partial import.
- Synchronize broker data.
- Create, edit, and delete an account.
- Create and edit a prop-firm account.
- Request a payout.
- View loading, stale, offline, permission, and error states.
- Recover after reconnect.
- Use the app on mobile.
- Navigate demo surfaces without production escape.
- View expired, unavailable, and valid shared reports.

### 17.4 Accessibility tests

- Playwright plus axe on representative routes.
- Keyboard-only completion of login, trade entry, filtering, trade edit, account creation, payout request, and deletion.
- Focus order and dialog trapping.
- Accessible names for icon buttons and row controls.
- Form error announcements.
- Calendar keyboard behavior.
- Screen-reader status announcements.
- Color contrast in dark/light mode and every accent pack.
- 200% zoom and text scaling.
- Heading hierarchy and landmark assertions on every selected route in Section 15.2.
- Chart textual summary or equivalent data access on reports, dashboard, prop-firm, and account analytics routes.
- Financial meaning assertions proving positive/negative, long/short, warning, and unavailable states remain understandable without color.
- Loading, stale, offline, permission, partial, empty, no-results, success, and disabled announcements or visible recovery contracts for every row in Section 5.10.

### 17.5 Responsive and visual tests

- Representative screenshots at required widths.
- Visual regression for dashboard, reports, trades, trade entry, account detail, settings, and public/shared report.
- Initial route skeleton screenshots.
- Background refresh must not replace prior content with skeletons.
- No layout shift during local loading.
- Reduced-motion verification.

The visual suite records cumulative layout shift for initial route load and requires no material layout movement from loading transitions; any regression above `0.1` CLS on a selected route fails the check. Local refresh tests assert that existing content remains mounted and visible while a background request is pending. Every screenshot includes its route, viewport, theme, accent pack, data state, and loading state in the test name.

### 17.6 Repository checks

- `bun run type-check`
- `bun run lint`
- `bun run test:ui-contracts`
- focused Vitest suites
- full `bun test --run`
- Playwright critical flows
- architecture contract scripts
- `bun run security:scan-console`
- `bun audit`
- `bun run build`
- Impeccable detector once after UI implementation is complete

## 18. Phased Implementation Plan

### Phase 1: Critical production and UX correctness

#### Task 1.1: Replace hardcoded entitlement

- Problem: client capability always returns true.
- Affected: `context/data-provider.tsx` and all entitlement consumers.
- Solution: typed capability DTO from server bootstrap; presentation-only helper.
- User benefit: accurate access and upgrade states.
- Technical impact: bootstrap type, context value, consumers, tests.
- Acceptance: all subscription states tested; server remains authoritative.
- Dependency/risk: inventory every consumer before replacement.

#### Task 1.2: Remove persisted provider credentials

- Problem: Tradovate access/refresh tokens persist in browser storage.
- Affected: sync store, provider context, auth cleanup.
- Solution: server-owned credentials or verified session-only bridge; remove stale persisted keys.
- User benefit: safer account integration.
- Technical impact: reconnect and logout flow.
- Acceptance: no credential in local storage; reconnect/logout tests pass.
- Dependency/risk: existing users may need to reconnect once.

#### Task 1.3: Harden canonical API handling

- Problem: direct fetches and inconsistent response checks.
- Affected: notifications, accounts, journal, trades, settings, subscription status.
- Solution: signal-composing typed API client and domain adapters.
- User benefit: truthful success/error feedback and actionable recovery.
- Technical impact: call-site migration and error types.
- Acceptance: HTTP failures cannot produce success UI.
- Dependency/risk: endpoint envelope differences must be explicitly adapted.

#### Task 1.4: Fix validation fail-open paths

- Problem: phase-validation network failures do not block trade creation.
- Affected: existing manual trade form and the canonical route introduced in Task 3.1.
- Solution: fail closed, persistent inline state, Retry, draft retention.
- User benefit: prevents invalid phase data.
- Technical impact: submission state machine and tests.
- Acceptance: all failure classes preserve data and block save in the existing form; the same state machine and tests are reused by the canonical route.

#### Task 1.5: Correct realtime and request lifecycles

- Problem: stale channels, dropped events, timer leaks, and stale responses.
- Affected: realtime manager, data provider realtime, account detail, prop-firm detail.
- Solution: generation ownership, cleanup, queued refresh, abort, request sequence.
- User benefit: current, stable account and trade data.
- Technical impact: shared realtime and fetch infrastructure.
- Acceptance: lifecycle and race tests pass.

#### Task 1.6: Fix critical semantic defects

- Problem: progress loses semantic value; trade overlays lack dialog semantics; dashboard can blank.
- Affected: progress, trade controllers, dashboard root.
- Solution: forward progress value, introduce accessible workspace boundary, add page skeleton.
- User benefit: understandable loading and complete keyboard access.
- Technical impact: shared primitives and route fallback.
- Acceptance: runtime semantics and loading tests pass.

### Phase 2: Tokens and shared primitives

#### Task 2.1: Rewrite `DESIGN.md`

- Problem: current document does not fully describe accent packs, semantic invariants, async states, and trading data.
- Affected: design documentation and all UI work.
- Solution: codify the approved system after token audit.
- User benefit: consistent product behavior.
- Technical impact: durable implementation contract.
- Acceptance: document matches code and has no contradictory token rules.
- Dependency/risk: exact token names must be confirmed during implementation.

#### Task 2.2: Separate accent and semantic tokens

- Problem: accent packs were barred from the win/loss financial roles, leaving loss/win hardcoded red/green regardless of the user's accent preference.
- Affected: globals, theme preferences, charts, badges, values.
- Solution: system semantics stay stable; brand accent layers also drive the win/loss financial pair (accent-1 win, accent-2 loss; Classic keeps red/green).
- User benefit: win/loss color coding follows the user's selected accent theme.
- Technical impact: token and usage migration.
- Acceptance: contrast and semantic screenshot tests pass for every pack.

#### Task 2.3: Consolidate primitives

- Problem: field, state, button, progress, and action behavior is inconsistent.
- Affected: `components/ui` and domain consumers.
- Solution: approved field, async state, financial value, filter chip, reveal action, workflow shell, and workspace contracts.
- User benefit: predictable interaction and feedback.
- Technical impact: shared component APIs and migration tests.
- Acceptance: primitives have runtime tests and documented examples.

### Phase 3: Forms and inputs

#### Task 3.1: Build canonical trade-entry route

- Problem: current modal is dense, fragile, and difficult to recover on mobile.
- Affected: manual trade form, Quick Add, empty states, route navigation.
- Solution: dedicated responsive route with draft and review states.
- User benefit: faster, safer entry without lost work.
- Technical impact: route, form state, navigation, validation.
- Acceptance: desktop/mobile flow, back behavior, draft resume, validation, and save tests pass.
- Dependency/risk: requires field primitives and entitlement/API correctness.

#### Task 3.2: Migrate account and prop-firm forms

- Problem: labels/errors and responsive layout are inconsistent.
- Affected: create/edit live account, prop-firm creation/settings, payout request.
- Solution: shared fields and responsive workflow shell.
- User benefit: clearer rules and fewer entry errors.
- Technical impact: form composition and validation.
- Acceptance: keyboard, mobile, error preservation, and duplicate-submit tests pass.

#### Task 3.3: Migrate authentication, settings, feedback, and import forms

- Problem: OTP and other secondary forms use uneven error and state behavior.
- Solution: apply field and async contracts.
- Acceptance: each form supports loading, inline error, success, disabled, and recovery behavior.

### Phase 4: Buttons and interactions

#### Task 4.1: Normalize action hierarchy

- Problem: one-off class overrides and vague labels weaken hierarchy.
- Affected: all pages.
- Solution: use shared variants and outcome labels.
- Acceptance: each page has a clear primary action and complete states.

#### Task 4.2: Replace nonsemantic and hover-only actions

- Problem: clickable SVGs and transparent focusable controls.
- Affected: filters, cards, uploads, tables, templates.
- Solution: semantic buttons, reveal behavior, accessible names.
- Acceptance: keyboard and touch tests pass.

#### Task 4.3: Standardize destructive actions

- Problem: destructive and bulk actions differ in confirmation and feedback.
- Solution: named trigger, consequence, explicit labels, pending state, rollback/retry behavior.
- Acceptance: no destructive action executes through an ambiguous control.

### Phase 5: Page-by-page workflow refactor

Each workflow below is a separate task with the listed owner and acceptance evidence. The complete route/state matrix in Section 5.10 is the authoritative route inventory.

#### Task 5.1: Dashboard overview

- Routes: `/dashboard`, dashboard error boundary, dashboard loading boundary.
- Dependencies: Phase 1.6, Phase 2 async-state family, Phase 7 query ownership.
- Acceptance: page skeleton, granular widget loading, partial failure, refresh preservation, freshness status, mobile and keyboard checks.

#### Task 5.2: Trades and trade workspace

- Routes: `/dashboard/table`, `/dashboard/table/loading`, trade detail/edit/replay surfaces.
- Dependencies: Phase 2 workspace, financial value, table, and filter primitives.
- Acceptance: sorting, row selection, bulk deletion confirmation, local overflow, accessible workspace, mobile priority view, and stale/refresh preservation.

#### Task 5.3: Reports and filters

- Routes: `/dashboard/reports`, `/dashboard/reports/loading`, report charts, filters, statements, and sharing.
- Dependencies: Phase 2 financial value, date-range filter, async-state, and navigation registry.
- Acceptance: scope visibility, chart units/legends/text equivalent, staged or immediate filters, partial metrics, stale refresh, mobile checks.

#### Task 5.4: Journal

- Routes: `/dashboard/journal`, `/dashboard/journal/loading`.
- Dependencies: Phase 2 field, async-state, reveal-action, and navigation primitives.
- Acceptance: note loading/saving/autosave/offline/error, trade-card actions on focus/touch, empty/no-results distinction, mobile and keyboard checks.

#### Task 5.5: Live accounts

- Routes: `/dashboard/accounts`, account loading boundary, `/dashboard/accounts/[id]`, detail loading boundary.
- Dependencies: Phase 1 request lifecycle and API client; Phase 2 account-summary and workflow primitives.
- Acceptance: create/edit/delete, detail back context, transient failure versus not-found, realtime preservation, mobile forms, keyboard checks.

#### Task 5.6: Prop-firm accounts and payouts

- Routes: all prop-firm account, trade, settings, and payout routes in Section 5.10.
- Dependencies: Phase 1 validation/realtime, Phase 2 field/financial/workflow primitives, route-removal gate.
- Acceptance: phase/rule semantics, trade validation, payout states, account detail consistency, route disposition, mobile and keyboard checks.

#### Task 5.7: Import and data management

- Routes: `/dashboard/import`, `/dashboard/data`, `/dashboard/data/loading`, import/upload/export components.
- Dependencies: Phase 1 API/error handling; Phase 2 async state and progress.
- Acceptance: upload validation, progress semantics, partial results, duplicate handling, offline/retry behavior, local loading only, mobile checks.

#### Task 5.8: Playbook

- Routes: `/dashboard/playbook`, `/dashboard/playbook/loading`.
- Dependencies: Phase 2 fields, cards, async state, financial value.
- Acceptance: list/card loading, empty/no-results, create/edit/delete, metric definitions, mobile and keyboard checks.

#### Task 5.9: Goals

- Routes: `/dashboard/goals`, `/dashboard/goals/loading`.
- Dependencies: Phase 2 fields, progress, async state.
- Acceptance: create/edit/delete, progress semantics, empty/error/success/disabled, mobile and keyboard checks.

#### Task 5.10: Backtesting

- Routes: `/dashboard/backtesting`, `/dashboard/backtesting/loading`.
- Dependencies: Phase 2 fields, workflow shell, async state, financial value.
- Acceptance: form validation, long-running state, result loading, cancellation/retry, empty/error, mobile and keyboard checks.

#### Task 5.11: AI workspace

- Routes: `/dashboard/ai` and AI child components.
- Dependencies: Phase 1 API/error lifecycle; Phase 2 async state and workspace primitives.
- Acceptance: consent, streaming, cancellation, rate limit, unavailable, error recovery, stable conversation content, mobile and keyboard checks.

#### Task 5.12: Settings

- Routes: `/dashboard/settings`, `/dashboard/settings/loading`.
- Dependencies: Phase 2 fields, workflow shell, button, destructive-action standards.
- Acceptance: responsive tab orientation, section-local saves, unsaved changes, integration states, destructive data/account actions, mobile and keyboard checks.

#### Task 5.13: Authentication and subscription

- Routes: `/login`, `/subscribe`, `/subscribe/status`, `/subscribe/success`, `/subscribe/cancelled`, and their boundaries. Protected redirects preserve a local `next` path; the former visible `/app-launch` session bridge is retired.
- Dependencies: Phase 1 API/cancellation; Phase 2 fields and async state.
- Acceptance: OTP recovery, resend behavior, payment verification timeout/retry/cancel, loading/error, mobile and keyboard checks.

#### Task 5.14: Public, legal, support, documentation, and global boundaries

- Routes: every route in Sections 5.1, 5.6, and 5.8.
- Dependencies: Phase 2 navigation registry and async state; route-removal gate.
- Acceptance: shared shell, route correctness, search navigation, metadata, 404/retry/back behavior, keyboard and mobile checks.

#### Task 5.15: Shared reports

- Routes: `/reports/shared/[slug]`, `/reports/error`, and new local loading/error boundaries.
- Dependencies: Phase 1 API/error handling; Phase 2 financial value and async state.
- Acceptance: typed snapshot, valid/expired/revoked/malformed/unavailable states, view-count status, mobile, keyboard, and visual checks.

#### Task 5.16: Demo routes

- Routes: every exact demo route in Section 5.5.
- Dependencies: Phase 2 navigation registry; completed production workflow migrations.
- Acceptance: no production escape, fixture state coverage, unsupported-action messaging, cache isolation, mobile and keyboard checks.

For every task:

- document primary job and action;
- use consistent page title/context;
- implement initial, local loading, refreshing, stale, offline, empty, no-results, partial, error, permission, success, and disabled states as applicable;
- preserve unaffected content during local loading and refresh;
- verify mobile, keyboard, and semantic behavior;
- verify URL and browser navigation state;
- remove duplicated one-off components after migration.

### Phase 6: Responsive and accessibility hardening

#### Task 6.1: Runtime accessibility suite

- Problem: source-string contracts cannot verify focus, names, announcements, calendar behavior, or modal containment.
- Affected: all selected routes in Section 15.2 and all critical workflows in Section 17.3.
- Solution: Playwright plus axe, keyboard flow assertions, and targeted semantic checks.
- User benefit: core workflows work with keyboard and assistive technology.
- Technical impact: e2e fixtures and stable test data.
- Acceptance: no known WCAG 2.2 AA blocking violation in critical flows; all Section 15.1 assertions have evidence.
- Dependency/risk: authenticated and demo test fixtures must be deterministic.

#### Task 6.2: Responsive and zoom suite

- Problem: shell responsiveness does not prove forms, tables, charts, and overlays work at every required width.
- Affected: selected routes in Section 15.2.
- Solution: viewport matrix, 200% zoom, dynamic viewport, sticky-action, local-overflow, and touch-target checks.
- User benefit: complete workflows on phone, tablet, desktop, and zoomed layouts.
- Technical impact: visual and interaction tests.
- Acceptance: every selected route passes 320, 375, 768, 1024, 1280, and wide-desktop checks; core tasks complete without global overflow.
- Dependency/risk: chart fixture timing and font rendering must be stabilized.

#### Task 6.3: Motion and semantic-color verification

- Problem: accent packs and animations can weaken state comprehension or accessibility.
- Affected: themes, accent packs, charts, values, loading, and change highlights.
- Solution: contrast checks, non-color meaning assertions, reduced-motion tests.
- User benefit: trustworthy financial state in every visual preference.
- Acceptance: every accent/theme combination passes contrast and financial states remain understandable without color.
- Dependency/risk: all semantic token migration must be complete.

### Phase 7: Data fetching, realtime, and state consolidation

#### Task 7.1: Domain server-state ownership

- Problem: React Query, SWR, context, Zustand, and module caches overlap.
- Affected: accounts, trades, journal, tags, templates, notifications, reports, prop-firm, goals, and settings.
- Solution: migrate one domain at a time to TanStack Query, removing the old owner after each verified migration.
- User benefit: consistent data after mutation, navigation, and realtime events.
- Technical impact: query keys, hooks, providers, cache cleanup.
- Acceptance: each domain documents one source of truth and invalidation path; old cache path is removed.
- Dependency/risk: migrations must not share demo/auth cache keys.

#### Task 7.2: Realtime and freshness model

- Problem: lifecycle races, reconnect exhaustion, and broad refresh behavior.
- Affected: account, trade, notification, and synchronization domains.
- Solution: session-owned realtime, typed events, targeted invalidation, degraded mode, freshness state.
- User benefit: current data without flicker or indefinite staleness.
- Technical impact: realtime provider and query integration.
- Acceptance: race, reconnect, coalescing, cleanup, and freshness tests pass.
- Dependency/risk: Supabase owner-scoped policies remain unchanged and authoritative.

#### Task 7.3: Metrics aggregation and large-data boundaries

- Problem: large record transfer for client metrics and duplicated requests.
- Affected: dashboard, reports, trade table.
- Solution: server aggregate endpoints plus bounded row queries.
- User benefit: faster analytics with clearer partial-data behavior.
- Technical impact: server query, API contract, client query hooks.
- Acceptance: metrics no longer require 100,000-row client payload; calculation scope and partial failure are tested.
- Dependency/risk: aggregate formulas must match existing verified calculations.

### Phase 8: Verification and cleanup

#### Task 8.1: Focused and broad verification

- Problem: a broad refactor can pass local checks while failing another workflow.
- Affected: all changed systems.
- Solution: focused tests during implementation and one complete final validation pass.
- User benefit: fewer production regressions.
- Technical impact: test and build execution only.
- Acceptance: type, lint, unit, UI contract, e2e, security, audit, architecture, and production build checks pass, or external/pre-existing blockers are evidenced.
- Dependency/risk: external-service checks require staging credentials and access.

#### Task 8.2: Visual and implementation integrity review

- Problem: semantic and responsive correctness does not alone guarantee coherent UI.
- Affected: every migrated workflow.
- Solution: visual regression review, desktop/mobile inspection, and one final Impeccable detector run.
- User benefit: consistent hierarchy without hidden functional regressions.
- Acceptance: approved baselines pass; detector findings are verified and resolved or documented as false positives.
- Dependency/risk: run detector only after UI implementation is finished.

#### Task 8.3: Removal and release documentation

- Problem: obsolete routes, components, styles, tests, and persisted keys remain after migration.
- Affected: route aliases, modal trade entry, duplicate caches/components, docs, changelog.
- Solution: remove replaced paths after route-removal evidence gate; document breaking changes and reconnection needs.
- User benefit: predictable routes and maintainable implementation.
- Acceptance: dead-code and broken-link scans are clean; release notes list every breaking route or integration change.
- Dependency/risk: route-removal inventory must be approved when external consumers exist.

## 19. Quick Wins

Quick wins are still sequenced behind critical correctness where they touch the same area.

- Fix `/docs/donate` destination.
- Replace dashboard `fallback={null}` with a page-structure skeleton.
- Forward progress `value` to Radix root.
- Fix nested Link/Button composition.
- Replace clickable filter SVGs with buttons.
- Add focus/touch visibility to contextual actions.
- Remove unreachable catch-all markup.
- Correct realtime `eventType` mismatch.
- Align settings tab orientation with responsive layout.
- Add route-local shared-report loading/error boundaries.

## 20. Larger Architectural Improvements

- Canonical trade-entry route and draft model.
- Session-owned realtime provider.
- TanStack Query domain ownership.
- Typed API error and capability DTOs.
- Server-side analytical aggregation.
- Unified navigation registry.
- Stable semantic financial-value system.
- Runtime accessibility and visual-regression suite.

## 21. Dependencies, Risks, and Migration Concerns

### 21.1 Dependencies

- Entitlement DTO precedes premium UI migration.
- Credential-storage decision precedes provider sync cleanup.
- API signal/error work precedes broad fetch migration.
- Field primitives precede form migration.
- Navigation registry precedes route cleanup.
- Trade workspace primitives precede overlay removal.
- Server aggregates precede removal of large client metrics queries.

### 21.2 Breaking changes

- Removing prop-firm redirect aliases can break bookmarks and external links.
- Replacing modal trade entry changes browser history and deep links.
- Removing persisted provider credentials may require reconnection.
- Cache ownership changes can alter refresh timing.

Breaking changes require release notes, updated internal links/docs/tests, and explicit verification. Obsolete paths are removed rather than retained through indefinite compatibility layers.

Before removing a route, complete a route-removal evidence gate:

1. Inventory all internal links, navigation entries, tests, documentation, host rewrites, and redirect callers.
2. Search repository-maintained external documentation and known integration callbacks.
3. Record available route analytics or state that analytics are unavailable.
4. Classify the route as internal-only, documented external, integration callback, or unknown.
5. Define its canonical replacement and update every controlled consumer.
6. Ask for product approval only when a documented or unknown external consumer creates a material breaking decision.
7. Remove the obsolete route and verify 404/canonical behavior; do not retain an indefinite compatibility alias.

### 21.3 Data and UX risks

- Draft persistence must be user scoped and contain no secrets.
- Retaining prior content during filter change must not misrepresent it as current.
- Optimistic behavior must not conceal server rejection.
- Accent migration must preserve user preference and readable contrast.
- Live and prop-firm account consolidation must not erase domain-specific rule behavior.
- Demo reuse must not trigger production calls.

### 21.4 Rollout strategy

- Ship by phase and workflow behind existing release discipline.
- Use staging for auth, subscription, provider sync, realtime, and database-dependent verification.
- Use controlled observability checks for failure classification and request IDs.
- Capture baseline visual regressions before page migration.
- Do not mark a phase complete until affected states and tests pass.

## 22. Detailed Master Checklist

### Correctness and security

- [ ] Inventory every `isPlusUser` consumer.
- [ ] Replace hardcoded entitlement.
- [ ] Add entitlement-state tests.
- [ ] Inventory persisted integration values.
- [ ] Remove persisted Tradovate access token.
- [ ] Remove persisted Tradovate refresh token.
- [ ] Remove stale persisted credential keys.
- [ ] Add logout cleanup.
- [ ] Add user-switch cleanup.
- [ ] Confirm server authorization on premium endpoints.
- [ ] Compose caller and timeout abort signals.
- [ ] Distinguish cancellation from timeout.
- [ ] Define canonical API error categories.
- [ ] Migrate critical direct fetch mutations.
- [ ] Prevent HTTP failure success UI.
- [ ] Fail closed on phase validation.
- [ ] Preserve draft during validation failure.

### Realtime and state

- [ ] Add session generation to realtime ownership.
- [ ] Cancel stale connections.
- [ ] Cancel reconnect timers.
- [ ] Clear current refresh timers on cleanup.
- [ ] Queue one refresh during active prop-firm fetch.
- [ ] Add account-detail abort behavior.
- [ ] Add stale-response guard.
- [ ] Correct event field mismatch.
- [ ] Type realtime event payloads.
- [ ] Add degraded realtime mode.
- [ ] Add freshness state and timestamp.
- [ ] Add targeted invalidation.
- [ ] Add optimistic rollback.
- [ ] User-scope private caches.
- [ ] Verify demo/auth cache isolation.
- [ ] Define one server-state owner per domain.
- [ ] Replace oversized client metrics query with server aggregation.

### Design system

- [ ] Audit current token usage and accent-pack persistence.
- [ ] Define stable semantic financial tokens.
- [ ] Define stable system state tokens.
- [ ] Define brand accent roles.
- [ ] Verify dark/light contrast.
- [ ] Verify every accent pack.
- [ ] Rewrite `DESIGN.md`.
- [ ] Consolidate button variants.
- [ ] Consolidate field primitives.
- [ ] Add financial-value primitive.
- [ ] Consolidate async states.
- [ ] Add accessible date-range filter.
- [ ] Add removable filter chip.
- [ ] Add reveal-action behavior.
- [ ] Add responsive workflow shell.
- [ ] Add trade workspace.
- [ ] Fix progress semantics.

### Loading and async states

- [ ] Add dashboard page-structure initial skeleton.
- [ ] Inventory every route-level loading boundary.
- [ ] Inventory every local component loading state.
- [ ] Replace blank initial states.
- [ ] Preserve stable shell and page context.
- [ ] Preserve prior content during background refresh.
- [ ] Preserve prior content during realtime update.
- [ ] Add subtle updating indicator where useful.
- [ ] Add freshness timestamp for stale-sensitive data.
- [ ] Preserve data after refresh failure.
- [ ] Show data age after refresh failure.
- [ ] Add Retry for refresh failure.
- [ ] Distinguish offline cached data.
- [ ] Distinguish partial data.
- [ ] Add determinate progress semantics.
- [ ] Prevent repeated skeleton flicker.
- [ ] Verify no layout shift.
- [ ] Respect reduced motion.

### Forms and inputs

- [ ] Build canonical trade-entry route.
- [ ] Implement user-scoped trade draft.
- [ ] Implement dirty-state back behavior.
- [ ] Implement review step.
- [ ] Add time-zone clarity.
- [ ] Add currency and unit semantics.
- [ ] Add paste-safe numeric parsing.
- [ ] Migrate live-account forms.
- [ ] Migrate prop-firm forms.
- [ ] Migrate payout form.
- [ ] Migrate settings forms.
- [ ] Migrate authentication and OTP.
- [ ] Migrate feedback form.
- [ ] Migrate import/upload forms.
- [ ] Add first-invalid focus.
- [ ] Add persistent error summaries for long forms.
- [ ] Prevent duplicate submissions.
- [ ] Verify autocomplete and input modes.
- [ ] Verify disabled/read-only distinctions.

### Buttons and interactions

- [ ] Inventory primary actions per page.
- [ ] Replace vague action labels.
- [ ] Replace clickable non-controls.
- [ ] Fix nested interactive elements.
- [ ] Fix hover-only action visibility.
- [ ] Add accessible names to icon controls.
- [ ] Verify tooltip use.
- [ ] Verify 44px touch targets.
- [ ] Standardize loading/disabled states.
- [ ] Standardize destructive confirmation.
- [ ] Confirm bulk deletion.

### Navigation and routes

- [ ] Build typed navigation registry.
- [ ] Generate desktop navigation.
- [ ] Generate mobile primary navigation.
- [ ] Generate More menu.
- [ ] Generate command palette destinations.
- [ ] Generate demo-aware paths.
- [ ] Fix docs donation path.
- [ ] Remove unnecessary redirect aliases.
- [ ] Standardize active-route matching.
- [ ] Add breadcrumbs where hierarchy requires them.
- [ ] Preserve URL filter/tab state.
- [ ] Verify browser back/forward.
- [ ] Update route tests and docs.

### Tables, charts, and financial data

- [ ] Add table accessible names/captions.
- [ ] Add row-specific selection labels.
- [ ] Add `aria-sort`.
- [ ] Add result count announcements.
- [ ] Verify local table overflow.
- [ ] Define mobile trade-row behavior.
- [ ] Add chart axis units.
- [ ] Add chart legends where multiple series exist.
- [ ] Add calculation scope and definitions.
- [ ] Add delayed/estimated/incomplete states.
- [ ] Ensure profit/loss is not color-only.
- [ ] Use tabular figures.
- [ ] Verify currency and percentage formatting.

### Page migration

- [ ] Dashboard overview.
- [ ] Trades table.
- [ ] Trade details/edit workspace.
- [ ] Reports.
- [ ] Journal.
- [ ] Accounts list.
- [ ] Live account detail.
- [ ] Prop-firm account detail.
- [ ] Prop-firm trades.
- [ ] Prop-firm payouts.
- [ ] Import.
- [ ] Data management.
- [ ] Playbook.
- [ ] Goals.
- [ ] Backtesting.
- [ ] AI workspace.
- [ ] Settings.
- [ ] Authentication/subscription.
- [ ] Public/legal/support.
- [ ] Shared reports.
- [ ] Demo routes.

### Accessibility and responsive verification

- [ ] Runtime axe tests.
- [ ] Login keyboard test.
- [ ] Trade-entry keyboard test.
- [ ] Filter keyboard test.
- [ ] Date-picker keyboard test.
- [ ] Trade-workspace focus test.
- [ ] Account-form keyboard test.
- [ ] Payout-form keyboard test.
- [ ] Destructive-dialog keyboard test.
- [ ] Screen-reader status checks.
- [ ] Reduced-motion checks.
- [ ] 200% zoom checks.
- [ ] 320px checks.
- [ ] 375px checks.
- [ ] 768px checks.
- [ ] 1024px checks.
- [ ] 1280px checks.
- [ ] Wide-desktop checks.
- [ ] Cross-browser checks.

### Final production verification

- [ ] Focused component tests.
- [ ] Focused integration tests.
- [ ] UI contract tests.
- [ ] Full unit/integration suite.
- [ ] Critical Playwright flows.
- [ ] Type check.
- [ ] Lint.
- [ ] Architecture checks.
- [ ] Console security scan.
- [ ] Dependency audit.
- [ ] Production build.
- [ ] Visual regression review.
- [ ] Impeccable detector.
- [ ] Sentry controlled-error verification.
- [ ] Request-ID verification.
- [ ] Staging realtime verification.
- [ ] Staging provider sync verification.
- [ ] Release notes for breaking changes.
- [ ] Final dead-code and placeholder scan.

## 23. Phase Completion Reporting

After each phase, report:

- what changed;
- files and systems affected;
- tests and states verified;
- checks not run and why;
- newly discovered risks;
- remaining tasks;
- migration or release concerns;
- whether acceptance criteria are fully met.

No phase is complete when required checks fail or affected loading, empty, error, success, disabled, offline, stale, permission, and partial states have not been tested.

## 24. Decisions Requiring Product Input During Implementation

The direction is approved. Implementation should stop for product input only when repository evidence cannot resolve a material behavior, including:

- whether a specific metric uses gross or net P&L when current code and copy disagree;
- which account currency governs multi-account aggregate presentation;
- whether partial date ranges are supported;
- whether a provider mutation may be safely queued offline;
- whether a destructive action should support undo instead of confirmation;
- which obsolete external route can be removed when external consumers are documented;
- whether delayed market or broker data has a contractual delay label not represented in code;
- whether trade grouping or multi-leg behavior changes the canonical trade-entry data model.

These questions must be asked one at a time, with evidence and concrete options. Ordinary implementation details do not require repeated approval.

## 24.1 Approved additions traceability

| Approved addition | Specification location | Implementation phase | Verification |
|---|---|---|---|
| Preserve dark and light themes | Sections 2, 7.2 | Phase 2 | contrast and visual tests in every theme |
| Preserve user-selectable accent packs | Sections 2, 7.2 | Phase 2 | preference, token, contrast, and visual tests for every pack |
| Keep system semantics stable while accent packs drive brand roles and the win/loss financial pair | Sections 7.2, 7.9 | Phase 2 | non-color financial assertions and token contract tests |
| Correctness and security before broad visual work | Sections 2, 18 Phase 1 | Phase 1 | Phase 1 acceptance gates before Phase 5 migration |
| Shared navigation, fields, buttons, async states, financial values, filters, dialogs, and trade workspaces | Sections 7 and 10 | Phase 2 | component/runtime tests and page migration evidence |
| Canonical dedicated trade-entry route | Section 9 | Phase 3.1 | route, draft, validation, mobile, keyboard, and browser-back tests |
| Granular component-matching skeletons | Section 8 | Phases 1.6, 2, and 5 | route/local loading visual tests and skeleton guardrail check |
| Do not blank or reset unaffected content during localized loading | Sections 8.3-8.6 | Phases 2, 5, and 7 | mounted-content assertions during pending requests |
| Preserve last valid content during background refresh and realtime updates | Sections 8.4-8.5 | Phases 5 and 7 | refresh/realtime integration tests |
| Preserve stale data after refresh failure with age, error, and Retry | Section 8.7 | Phases 2, 5, and 7 | recoverable-refresh failure tests |
| Distinguish initial loading, refreshing, stale, realtime, offline, and error | Sections 8.1 and 25 | All phases | route/state matrix evidence |
| Respect reduced motion and avoid skeleton flicker/layout shift | Sections 8.2, 8.10, 15, and 17 | Phases 6 and 8 | reduced-motion, CLS, and visual regression tests |

## 25. Success Criteria

The refactor succeeds when:

- users see only capabilities they actually have;
- sensitive provider credentials are not persisted in browser storage;
- data does not regress due to stale responses, dropped realtime events, or cache crossover;
- users can complete critical workflows with mouse, touch, or keyboard;
- trade entry preserves work and behaves predictably with browser navigation;
- financial meaning is stable across dark/light themes and every accent pack;
- initial loading, local loading, background refreshing, realtime, empty, no-results, success, disabled, stale, offline, partial, permission-denied, recoverable-error, and blocking-error states are distinct;
- skeletons appear only for genuinely missing content;
- unaffected content remains visible during local and background activity;
- every page has consistent navigation, hierarchy, actions, and recovery behavior;
- runtime accessibility, responsive, critical-flow, security, and production checks pass;
- the final component and state architecture has one clear owner for each responsibility.
