# Stable Semantic UI System Report

## Scope

Implemented the shared-system subset of plan Tasks 2.1, 2.4, and 2.5 without page-wide migrations or changes to theme preference persistence, realtime, APIs, credentials, or workspaces.

## Changes

- Rewrote `DESIGN.md` around the actual light-root, dark-class, system preference, and independent accent-class behavior.
- Added stable brand, system-semantic, and financial token roles. Accent selectors now override brand roles only.
- Preserved existing component utility names by mapping them to the new stable roles.
- Added the `AsyncDataState` contract and `AsyncState` renderer to the existing `components/ui/states.tsx` module. Refresh, realtime, stale, offline, partial, and recoverable-error states retain prior data.
- Forwarded `Progress` values to the Radix root while retaining determinate zero behavior.
- Added the minimal `FinancialValue` display primitive with explicit signs, units, stable financial tones, data-quality labels, and unavailable handling.

## TDD Evidence

The four new focused test files were run before implementation. All four failed for the expected missing behavior: absent async and financial components, missing Radix progress value forwarding, and semantic/financial token absence plus accent overrides.

After implementation, the focused theme/state/progress suite passed 25 tests across 6 files. TypeScript and focused ESLint completed with no findings.

## Skeleton Guardrail

The documented command completed and reported existing `animate-pulse` consumers. This batch added no new `animate-pulse` usage and did not migrate existing page-owned skeletons.

## Remaining Scope

- Existing pages continue to use legacy utility names, now mapped to stable roles. Page migration remains with their owning tasks.
- Date filters, removable chips, and broad financial-value migration from Task 2.5 were intentionally excluded from this shared-system batch.
- Existing skeleton guardrail matches remain for later route migrations.
