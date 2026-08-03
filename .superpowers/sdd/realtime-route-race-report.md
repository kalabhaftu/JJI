# Realtime Route Race Report

## Scope

- Suppressed errors and reconnect work from stale realtime connection generations before they can notify the current session.
- Aborted and invalidated live-account, prop-firm account, trade, and payout requests when the route account identity changes.
- Reset account-derived state across account identity changes while retaining prior data for same-account refresh failures.
- Prevented stale trade-triggered refreshes and late request bodies from committing data to a different account route.

## Behavioral Coverage

- Added a stale-generation catch regression proving an old connection failure cannot emit an error to the replacement session.
- Added account A-to-B regressions proving the old request is aborted, account and drawdown state are cleared during transition, and late account/trade refresh responses cannot replace account B.

## Verification

- Focused realtime and stale-response suite: 5 files, 9 tests passed.
- TypeScript type-check passed.
- Focused ESLint passed with no findings.
- `git diff --check` passed.

## Concerns

- Vitest continues to print the existing Node `--localstorage-file` warning in realtime tests; it does not affect results.
