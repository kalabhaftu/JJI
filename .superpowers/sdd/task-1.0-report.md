# Task 1.0 Report

## Status

Implemented the minimal scoped server-state contracts without migrating any domain or changing application UI.

## Files Changed

- `lib/query/query-scope.ts`
  - Defines `QuerySurface` and `QueryScope`.
- `lib/query/query-keys.ts`
  - Defines scoped key factories for accounts, trades, journal, tags, templates, report stats, and notifications.
- `lib/query/query-ownership.ts`
  - Defines `ServerStateDomain`, `DomainOwnership`, and the ownership registry for all ten server-state domains.
- `tests/unit/query-keys.test.ts`
  - Verifies demo and authenticated keys are distinct, authenticated users are isolated, and all supported factories include scope.
- `tests/architecture/query-ownership.test.ts`
  - Verifies every server-state domain is owned by TanStack Query and has key, invalidation, and mutation contracts.

## TDD Evidence

The focused tests were run before implementation and failed because the query-key and ownership modules did not exist:

```text
FAIL tests/architecture/query-ownership.test.ts: Failed to resolve import "@/lib/query/query-ownership"
FAIL tests/unit/query-keys.test.ts: Failed to resolve import "@/lib/query/query-keys"
Test Files 2 failed, Tests no tests
```

After implementation, the same focused command passed:

```text
bun run test -- --run tests/unit/query-keys.test.ts tests/architecture/query-ownership.test.ts
Test Files 2 passed (2)
Tests 4 passed (4)
```

## Verification

- `bun run type-check`: passed with exit code 0.
- `bun run lint`: passed with exit code 0; one existing warning remains at `context/data-provider.tsx:529` for an unnecessary `locale` dependency in a React Hook.
- Focused Vitest command: passed, 2 files and 4 tests.

## Concerns

- The full test suite was not run because the task brief specified focused tests only.
- Lint reports the unrelated existing React Hook warning noted above; no application UI or domain migration files were changed.

## Review Fix

The ownership contract previously allowed arbitrary strings and referenced nonexistent `queryKeys.propFirm`, `queryKeys.goals`, and `queryKeys.settings` factories. The architecture test now resolves every established ownership reference against the actual `queryKeys` object. The contract restricts established references to ``queryKeys.${keyof typeof queryKeys}`` and uses the explicit `not-established` state for the three domains whose factories are outside Task 1.0's approved interface.

### Review-Fix TDD Evidence

The strengthened architecture test failed before the contract fix:

```text
bun run test -- --run tests/unit/query-keys.test.ts tests/architecture/query-ownership.test.ts
FAIL tests/architecture/query-ownership.test.ts > server state ownership > declares TanStack Query as the owner for every server-state domain
AssertionError: expected undefined to deeply equal Any<Function>
Test Files 1 failed | 1 passed (2)
Tests 1 failed | 3 passed (4)
```

After the minimal type-safe contract fix:

```text
bun run test -- --run tests/unit/query-keys.test.ts tests/architecture/query-ownership.test.ts
Test Files 2 passed (2)
Tests 4 passed (4)
Duration 2.51s
```

### Review-Fix Verification

```text
bun run type-check
$ tsc --noEmit
Exit code 0
```

```text
bunx eslint lib/query/query-ownership.ts tests/architecture/query-ownership.test.ts
No output
Exit code 0
```

### Review-Fix Concerns

- `prop-firm`, `goals`, and `settings` intentionally remain `not-established`; adding their query-key factories would exceed the approved Task 1.0 interface and constitute domain-contract expansion.
- The full test suite was not run; verification remains scoped to the requested tests, type-check, and focused lint.
