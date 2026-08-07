# JJI Design System

## Product Character

JJI is a calm, information-dense workspace for reviewing trading decisions. Decoration must not compete with account state, risk, results, or the next action. Use sentence case, direct language, and the 12px operational text floor.

## Theme Behavior

The root token set is the light theme. The `dark` class replaces surface, text, brand, semantic, and financial values for dark mode. The theme provider preserves the user preference as `light`, `dark`, or `system`; `system` resolves through `prefers-color-scheme`. It applies exactly one `light` or `dark` class and does not couple theme preference to accent preference.

Accent preferences apply one of `accent-reports`, `accent-violet`, or `accent-slate`; Classic applies no accent class. Accent classes coexist with `light` or `dark`, override brand roles, and drive the win/loss financial pair: accent-1 is the win color and accent-2 the loss color. Classic keeps the default red/green financial values. Accent classes must never override system status semantics.

## Token Roles

Use role tokens rather than palette names in product UI.

- Brand: `--brand-primary`, `--brand-selected`, `--brand-navigation-active`, and `--brand-chart-accent-*` express identity, selection, navigation emphasis, and non-semantic chart series. Existing `primary` utilities remain the component-facing brand alias.
- System semantics: `--semantic-success`, `--semantic-warning`, `--semantic-destructive`, `--semantic-error`, `--semantic-permission`, and `--semantic-disabled` retain the same meaning across accent packs. Success is a completed system outcome. Warning needs attention. Destructive is an irreversible action. Error is a failed operation. Permission denotes unavailable authorization. Disabled denotes unavailable interaction.
- Financial semantics: `--financial-profit`, `--financial-loss`, `--financial-long`, `--financial-short`, `--financial-bullish`, `--financial-bearish`, and `--financial-neutral` default to red/green within each light or dark theme. An active accent pack redefines the win/loss pair (profit/loss, long/short, bullish/bearish) to the pack's two accent colors, while `--financial-neutral` and system semantics remain stable. Profit/loss describe results, long/short describe direction, and bullish/bearish describe market movement. These roles are not interchangeable with system success or destructive actions.
- Surfaces and hierarchy: `background`, `card`, `popover`, `surface-raised`, `surface-subtle`, `foreground`, `heading-text`, `muted-foreground`, `border`, and `border-strong` establish hierarchy independently from brand and semantic color.

Color never carries financial or system meaning alone. Pair it with a sign, label, icon, status text, unit, or quality indicator. Text/control pairs must meet WCAG AA in light and dark themes.

## Financial Values

Use `FinancialValue` when a shared consumer needs explicit financial presentation. Values include their unit, use an explicit sign when comparison direction matters, and expose quality such as estimated, delayed, incomplete, stale, or unavailable. Missing values render as unavailable, never as zero. Do not migrate all existing displays until their owning page task.

## Async States

`components/ui/states.tsx` is the sole shared async-state module. Distinguish initial loading, local loading, success, refreshing, realtime updating, stale, offline, partial, permission denied, recoverable error, blocking error, empty, and no results when applicable.

Initial and local loading may use skeletons because no applicable content exists. Refreshing, realtime updating, stale, offline, partial, and recoverable-error states preserve prior content and add an adjacent status. Never replace valid prior data with a page skeleton during background work. Route skeletons describe page structure; granular skeletons describe only genuinely missing component data.

## Interaction And Layout

Visible focus is mandatory. Icon-only controls require accessible names. Core pointer targets are at least 44 by 44 CSS pixels. Blocking errors use assertive announcements; background status uses polite announcements. Reduced motion removes decorative movement while preserving state, progress, and focus feedback.

Global page overflow remains visible. Wide tables, timelines, and charts own horizontal scrolling locally. Controls use 8px radii, repeated surfaces use 12px radii, and pills are reserved for status, tags, and compact filters.
