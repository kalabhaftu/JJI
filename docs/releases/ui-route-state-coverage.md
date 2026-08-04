# UI Route and State Coverage

This ledger uses shared component and route-family evidence rather than duplicating identical tests for every route.

| Route family | Shared evidence | Initial/loading | Refresh/stale | Error/recovery | Permission/empty | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| Dashboard, journal, reports, data | `tests/ui`, `tests/components/async-states.test.tsx` | Shared async states | Last-valid-data contract | Inline retry states | Empty/no-results states | Phase 5 |
| Trade entry and trade workspace | `tests/components/trade-workspace.test.tsx`, `tests/components/trade-entry-draft.test.ts`, `tests/ui/manual-trade-submission.test.ts` | Route loading boundary | Draft preservation | Validation and retry | Account/permission validation | Phase 3 |
| Accounts and prop-firm | `tests/prop-firm`, account route contracts | Page and section skeletons | Realtime freshness | Route error boundaries | Permission and missing-account states | Phase 3/5 |
| Import and synchronization | `tests/integration/csv-import.test.ts`, polling contracts | Import skeletons | Progress/partial preservation | Recoverable import errors | Disabled/offline states | Phase 3/5 |
| Settings, auth, subscription | Auth-flow and settings contracts | Form-local loading | Section-local saves | Persistent field errors | Auth/permission states | Phase 3/5 |
| Public, docs, legal, shared reports | Public-surface and navigation contracts | Static route boundaries | N/A: no authenticated refresh owner | Route error boundary | N/A: no authenticated mutation | Phase 5 |
| Demo routes | Demo isolation and navigation contracts | Demo route boundaries | Demo-local state only | Demo-safe recovery | N/A: no persisted account mutation | Phase 5 |

N/A entries are technical: static/public routes have no authenticated server-state owner, and demo routes must not expose authenticated mutations.
