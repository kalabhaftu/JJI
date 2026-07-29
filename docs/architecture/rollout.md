# Architecture remediation rollout

Local implementation is reversible. Do not push, deploy, apply migrations, or
activate provider alerts from this workflow.

Release order:

1. apply the Supabase audit-context migration in staging;
2. run migration list/dry-run and database advisors;
3. deploy API/domain changes with the canonical client compatibility reader;
4. verify request correlation and Sentry privacy in staging;
5. run authenticated critical journeys;
6. compare the fresh analyzer report with `bundle-baseline.json`;
7. activate reviewed Sentry alerts;
8. promote only after representative desktop/mobile verification.

Rollback is application-first because the database columns are nullable and
backward compatible. The migration does not rewrite or delete data.
