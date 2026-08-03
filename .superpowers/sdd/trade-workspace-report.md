# Trade Workspace Foundation

## Scope

Established the reusable accessible `TradeWorkspace` foundation with route, dialog, and sheet modes. Migrated global, table, data trade, journal trade, and daily-note overlays to the shared workspace primitives. No API, entitlement, credential, realtime, design-token, or manual-trade-validation files were changed.

## Accessibility and behavior

- Dialog and sheet modes use the existing Radix primitives with explicit titles and descriptions.
- Escape, pointer-outside, interact-outside, and controlled close paths pass through dirty-state confirmation.
- Radix handles modal focus trapping and restoration.
- Route mode renders a named region without modal semantics.
- `useUnsavedChanges` protects browser unloads and gates route transitions.
- `useRouteWorkspace` preserves the originating pathname/query and restores it on close.

## Verification

- Focused Vitest: 5 files, 11 tests passed.
- Type-check: passed.
- Focused ESLint: passed with no output.

## Concerns

- React 19 emits no act warnings after enabling the test environment flag.
- Existing trade panels retain their domain behavior and styling; this change only establishes and adopts the workspace boundary.
