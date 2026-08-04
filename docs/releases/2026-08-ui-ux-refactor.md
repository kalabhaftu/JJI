# August 2026 Application UI/UX Refactor

This refactor establishes scoped server-state ownership, session-safe realtime handling, stable semantic colors, accessible form and workflow primitives, centralized navigation, granular async states, and canonical trade entry at `/dashboard/trades/new`.

Users with previously persisted Tradovate credentials must reconnect the integration. Private query, SWR, module, and provider state is cleared across identity transitions. Demo data remains isolated from authenticated caches.

Obsolete internal `/docs/donate` links now resolve to `/donate`. Other route aliases remain until analytics and external-consumer evidence are available.

Rollback is performed by reverting the refactor commits on `preview`. No database migration is required for the shared UI foundations. Support should ask users to reconnect provider credentials and refresh once after deployment if cached application state predates this release.
