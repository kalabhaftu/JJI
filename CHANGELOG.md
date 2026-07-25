# Changelog

## Unreleased

- Rebuilt the AI area as a consent-gated evidence workspace with selectable data sources, bounded context, saved chats, insights, mappings, and weekly reviews.
- Fixed duplicated global navigation/footer surfaces and made mobile navigation, widget sizing, safe-area spacing, and touch targets consistent.
- Introduced a shared surface, card, button, and theme hierarchy to reduce nested containers and inconsistent page controls.
- Hardened trade updates, imports, exports, cron routes, rate limits, ownership filters, client-IP handling, Content Security Policy, and offline cache privacy.
- Consolidated Redis access on Upstash, removed placeholder background jobs and analytics controls, and reduced global client work and duplicate API authentication.
- Added staged RLS and daily-anchor idempotency migrations plus security, privacy, ownership, migration, and mobile-layout regression coverage.
- Hardened Storage owner policies, aligned legacy weekly-review data without dropping records, added missing foreign-key indexes, and enforced deterministic UI, offline-mutation, and WCAG theme-contrast contracts.
- Updated CI and local tooling for Node.js 24, patched dependency chains, reproducible installs, secret scanning, and production console checks.
