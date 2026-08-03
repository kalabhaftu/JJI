# Realtime Generation Safety Report

## Scope

- Added shared realtime event/session types in `lib/realtime/types.ts`.
- Added session generation guards around asynchronous channel installation, status callbacks, change callbacks, and reconnect timers.
- Preserved owner-scoped `userId=eq.<userId>` filters for the existing filtered tables.
- Normalized Supabase `eventType` into the typed `change.event` field and updated the accounts consumer.

## Verification

- RED: focused realtime tests failed before implementation because the manager and normalizer were absent.
- GREEN: focused realtime tests passed: 2 files, 2 tests.
- Type-check passed with `bun run type-check`.
- Focused ESLint passed with `bunx eslint lib/realtime/types.ts lib/realtime/database-realtime.ts app/dashboard/accounts/page.tsx tests/unit/database-realtime-generation.test.ts tests/unit/database-realtime-events.test.ts`.

## Concerns

- Vitest emits the existing Node warning that `--localstorage-file` was provided without a valid path; it does not affect the focused test result.
- No TradeWorkspace, API client, credential, token, or styling files were changed.
