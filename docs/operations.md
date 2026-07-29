# Production operations

## Environments

| Environment | Branch | URL | Data |
|---|---|---|---|
| Local | developer branch | `http://localhost:3000` | development services |
| Preview | `preview` | `https://justjournalit.vercel.app` | staging services |
| Production | `main` | `https://www.justjournalit.site` | production services |

Preview must not mutate production database, Storage, Redis, payments, email, OAuth, Inngest, or AI state.

## Pre-deployment gate

```bash
bun install --frozen-lockfile
bun run type-check
bun run lint
bun run test -- --run
bun audit
bun run security:scan-console
bunx drizzle-kit check
bun run build
```

Confirm zero public browser source maps and review route bundle sizes from the build output.

## Database gate

- Staging branch current
- Pending migrations rehearsed in order
- Data-preservation queries passed
- RLS, grants, policies, indexes, and Realtime verified
- Storage owner-prefix matrix passed
- Production restore point recorded

## Service checks

### Supabase

- Project healthy
- Auth redirects canonical
- Security and performance advisors reviewed
- Migration history current
- Database and Storage policies verified

### Upstash Redis

- `PING` succeeds
- Controlled set/get/TTL/delete succeeds
- Sensitive rate limits fail closed when the backend is unavailable
- Cache keys use finite TTLs
- Mutation invalidation removes or expires affected entries

### Inngest

- `/api/inngest` is synced in the correct environment
- Event and signing keys are configured
- Registered function count and IDs match source
- Scheduled functions have current runs
- Retry and failure behavior is visible

### Sentry

- Production environment and release are set
- Controlled scrubbed event is retrievable
- Source maps resolve server frames
- Unresolved production issues are reviewed
- Alerts route to the current maintainer

### Vercel

- Build uses Node.js 24 and `bun install --frozen-lockfile`
- Preview deployment is ready
- Production domain is `www.justjournalit.site`
- Preview/pre-release domain is `justjournalit.vercel.app`
- Docs host is `docs.justjournalit.site` and rewrites to `/docs/*` on the main app
- Health endpoint reports database and Redis up
- Cron requests authenticate

## Deployment order

1. Push and verify `preview`.
2. Rehearse database and Storage changes.
3. Record production restore point.
4. Apply backward-compatible database migrations.
5. Deploy production application.
6. Apply policy changes that require the new code.
7. Verify health, jobs, monitoring, auth, and primary API paths.
8. Merge `preview` into `main`.
9. Verify the production commit and branch state.

## Incident response

1. Stop the rollout or disable the affected feature.
2. Record time, deployment ID, release, route, request ID, and environment.
3. Review Vercel logs, Sentry issues, Inngest runs, Supabase logs/advisors, and Redis health.
4. Reproduce with the smallest safe request.
5. Fix with a regression test.
6. Deploy through preview.
7. Verify the original incident signature is absent.

Do not resolve Sentry issues or delete operational evidence until the fix is deployed and verified.

## Rollback

- Application: promote the last known-good Vercel production deployment.
- Database: use the recorded restore point for destructive failures; use a reviewed forward migration for additive failures.
- Storage: restore previous bucket visibility and policies only with explicit object-access verification.
- Redis: delete the affected namespace or let bounded TTLs expire; never flush the full production database during routine rollback.
- Inngest: pause the affected function or remove its trigger, then inspect incomplete runs before replay.

## Google Search Console setup

1. Deploy the production changes.
2. Confirm the website opens over HTTPS.
3. Confirm `/robots.txt` works.
4. Confirm `/sitemap.xml` works.
5. Open Google Search Console.
6. Select "Domain" property.
7. Enter the root domain without `https://` or paths (e.g. `justjournalit.site`).
8. Copy Google's DNS TXT verification record.
9. Add the TXT record through the domain's DNS provider.
10. Wait for DNS propagation.
11. Click "Verify" in Google Search Console.
12. Open the Sitemaps section.
13. Submit `sitemap.xml`.
14. Inspect the homepage and important public pages using URL Inspection.
15. Request indexing where appropriate.
16. Keep the DNS TXT record after verification.

Note:
* Adding the site to Search Console does not guarantee immediate indexing.
* DNS verification may be immediate or may require additional propagation time.
* Search Console reporting data may take several days to appear.
* Google decides whether and when each page is indexed.
