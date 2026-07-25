# Contributing

## Workflow

1. Start from the current `preview` branch.
2. Keep changes focused and preserve unrelated work.
3. Add or update regression coverage.
4. Update documentation and `CHANGELOG.md` when behavior changes.
5. Run the full repository gate.
6. Use Conventional Commit messages.

## Engineering requirements

- Maintain authentication and ownership predicates on protected routes.
- Validate request payloads at the API boundary.
- Keep privileged modules server-only.
- Preserve database, cache, job, and Storage idempotency.
- Reuse shared UI primitives and accessibility contracts.
- Do not add dependencies without checking maintenance activity, current releases, and bundle impact.

## Full gate

```bash
npm ci
npm run type-check
npm run lint
npm test -- --run
npm audit --audit-level=low
npm run security:scan-console
npx drizzle-kit check
npm run build
```

## Database changes

Update the Drizzle schema and commit a reviewed Supabase migration. Rehearse it against staging. Include data-preservation, verification, and rollback notes. Never use schema push against production.

## Review checklist

- User-visible behavior remains complete.
- Cross-tenant access is impossible.
- Error and empty states are handled.
- Mobile and keyboard behavior remain covered by deterministic contracts.
- Cache entries expire and mutations invalidate affected data.
- Background work is idempotent and registered.
- Logs and Sentry payloads exclude secrets and unnecessary PII.
- Documentation matches the final implementation.
