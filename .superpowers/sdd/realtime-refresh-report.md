# Realtime Refresh Report

## Scope

- Fixed realtime timer cleanup to clear the current timer refs on unmount.
- Coalesced burst events into one scheduled refresh per scope with one cooldown follow-up.
- Added abort controllers and request sequence guards to prop-firm and live-account detail requests.
- Suppressed stale route responses and cancellation errors.
- Preserved existing account, trade, and payout data when transient refreshes fail and surfaced errors in context.
- Consumed the typed `DatabaseChange` realtime contract in regression tests.

## TDD Evidence

- RED: focused tests initially reported three expected behavior failures: three refreshes for one burst, a timer firing after unmount, and no abort signal on route change.
- GREEN: `bun run test -- --run tests/unit/realtime-refresh-coalescing.test.ts tests/unit/realtime-timer-cleanup.test.ts tests/unit/stale-response-guards.test.ts tests/unit/database-realtime-generation.test.ts tests/unit/database-realtime-events.test.ts` passed 6/6 tests.

## Verification

- `bun run type-check`: passed.
- Focused ESLint on all modified source and test files: passed with no output.
- `git diff --check`: passed.

## Concerns

- Vitest prints an existing Node `--localstorage-file` warning during the realtime generation tests; it does not fail the suite.
