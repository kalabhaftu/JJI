# Security

## Reporting

Report security issues privately to `justjournalit1@gmail.com`. Include the affected route or feature, reproduction steps, impact, and any relevant request or event identifier.

Do not disclose active vulnerabilities publicly before remediation is available.

## Supported release

The current production deployment at `https://www.justjournalit.site` is the supported release.

## Security invariants

- Supabase sessions are validated server-side.
- Protected database queries include owner predicates.
- Browser database writes are revoked.
- RLS and Storage policies provide defense in depth.
- Service-role, database, Redis, Inngest, payment, email, AI, and Sentry credentials remain server-only.
- Imports, exports, uploads, webhooks, and external URLs are bounded and validated.
- Sensitive production rate limits fail closed.
- Shared offline caches do not store authenticated documents, APIs, or private media.
- Sentry payloads are scrubbed and browser source maps are not published.

## Maintainer response

1. Preserve the report and operational evidence.
2. Reproduce in an isolated environment.
3. Contain the affected feature or credential.
4. Add a regression test.
5. Deploy through preview.
6. Verify production and rotate exposed credentials when applicable.
7. Document the fix in `CHANGELOG.md` without publishing exploit details.
