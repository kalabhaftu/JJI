# Navigation and Filter Batch Report

## Scope

Implemented the shared navigation and filter subset from Tasks 2.2 and 2.5. Existing Phase 1 security, realtime, and trade-workspace code was not modified. The existing financial-value and progress work remained unchanged.

## Navigation

- Added `lib/navigation/registry.ts` as the typed canonical source for navigation IDs, labels, paths, groups, active matching, capabilities, and authenticated/demo/docs/public resolution.
- Migrated desktop sidebar, mobile primary navigation and More dialog, command-palette shell actions, Quick Add reporting context, docs support navigation, empty states, navbar, and data/table callers.
- Corrected the docs donation destination from `/docs/donate` to `/donate` in navigation and search flows.
- Added nested active-route matching and demo-isolation contracts. Registry-managed demo destinations resolve through `/demo` or the demo host and never emit `/dashboard`.
- Preserved the existing mobile destination order and shell behavior.

## Filters

- Replaced the bespoke calendar implementation with installed `react-day-picker` v9, including its grid, named day buttons, roving keyboard focus, month navigation, and range semantics.
- Added `DateRangeFilter` with immediate preset/custom-range commits. Removed the contradictory date Apply action from the global filter surface; the instrument multi-select remains intentionally staged because it edits a checklist before commit.
- Added `RemovableFilterChip` with a real, named button instead of clickable SVG icons and migrated data-table chips.
- Added `lib/filters/filter-state.ts` for stable local-date URL encoding/decoding, repeated account/instrument values, invalid-value handling, and preservation of unrelated query parameters.
- Connected data-table filter state to URL parameters using immediate updates and preserved demo-aware data routes.

## Verification

- Focused Vitest batch: 9 files, 23 tests passed.
- `bun run type-check`: passed.
- Focused ESLint over all changed TypeScript/TSX files: passed after cleanup.
- Impeccable UI detector over changed filter/navigation UI: no findings.
- `git diff --check`: passed.

## Concerns

- URL filter persistence is currently migrated on the data-management trade table. Other report/global filter state still uses its existing context/controller ownership; the shared codec is available for those surfaces when their URL contract is defined.
- The navigation registry intentionally covers canonical shell destinations, not dynamic prop-firm/account/trade-detail routes. Those remain route builders owned by their feature domains.
