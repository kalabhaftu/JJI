# Workspace Interaction Gap Fix

## Scope

Closed only the Task 1.6 workspace review gaps: migrated trade-edit Back/Cancel dirty handling, daily-note dirty close, route workspace return behavior, duplicate sheet semantics, and duplicate global save/close behavior. The unused `useUnsavedChanges` hook and its isolated test were removed because no production caller adopted them.

## Changes

- Added workspace-owned close controls so migrated panel buttons use the same dirty confirmation path as Escape, outside interaction, and the Radix close button.
- Removed the daily-note panel's second close button; the sheet close is now the single close control and remains dirty-aware.
- Added a fallback return destination to `useRouteWorkspace` and adopted it in the table route instead of hardcoded close replacements.
- Kept legacy Sheet fallback semantics while allowing `TradeWorkspace` to declare its own single title and description.
- Removed the global controller's post-save close because `TradeEditPanel` already performs the close after a successful save.

## Behavioral Coverage

- Migrated workspace close buttons open dirty confirmation rather than closing directly.
- Route workspaces return to the supplied route after remounting on a workspace URL.
- Rendered sheets expose one title, one description, and one close control.
- Global trade saves update once and close once.

## Verification

- Focused Vitest: `tests/components/trade-workspace.test.tsx`, `tests/components/global-trade-controller.test.tsx`, `tests/unit/route-workspace.test.tsx`, and `tests/ui/dialog-semantics.test.ts`.
- Type-check: `bun run type-check`.
- Focused ESLint across all modified TypeScript and TSX files.

## Concerns

- Route return state is in memory when opened through `openWorkspace`; direct/remounted workspace URLs use the explicit canonical fallback supplied by the route.
- Dependencies were installed with `bun install --frozen-lockfile` because this isolated worktree initially had no test binaries. The lockfile was not changed.
