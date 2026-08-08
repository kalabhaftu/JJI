# Architecture

## Runtime

JJI is a Next.js App Router application deployed on Vercel. Routes render server-side or dynamically as required. Interactive dashboard surfaces use client components behind authenticated server layouts.

## Request flow

```text
Browser
  -> Next.js proxy and route guards
  -> App Router page or /api/v1 handler
  -> Supabase session validation
  -> internal JJI user resolution
  -> Zod request validation
  -> Drizzle query with ownership predicate
  -> Supabase Postgres
```

Public and shared-report routes have explicit unauthenticated contracts. Demo routes use local fixtures and a route-local interceptor; they do not access production user data.

Protected dashboard loading is staged: the server layout resolves authentication, internal-user access, and subscription entitlement before loading the dashboard bootstrap payload. The client then reconciles account-filter selections against canonical accounts before starting trade, aggregate, and prop-firm detail queries. See [Authentication and dashboard bootstrap](architecture/auth-bootstrap-and-logout.md).

## Application layers

| Path | Responsibility |
|---|---|
| `app/` | Routes, layouts, API boundaries, server actions |
| `components/` | Shared product and UI components |
| `context/`, `hooks/` | Client state and data access |
| `server/` | Server-only queries and domain operations |
| `lib/services/` | Reusable business logic |
| `lib/db/` | Drizzle client, schema, relations |
| `lib/security/` | Authentication-adjacent validation and request controls |
| `lib/cache/` | Redis cache-aside and invalidation |
| `lib/inngest/` | Durable functions |

## Authentication and ownership

Supabase Auth provides the external session identity. Server code resolves that identity to the internal JJI user record. Every protected read and mutation includes the internal user in its database predicate. Resource existence is not sufficient authorization.

RLS supplies a second boundary. Browser database writes are revoked. Realtime access is limited to owner-scoped reads on the tables used by live UI updates.

## Data access

Drizzle is the application query layer. Schema modules are grouped by domain under `lib/db/schema/`. Vercel functions use the Supabase transaction pooler with prepared statements disabled. Migrations are reviewed SQL under `supabase/migrations/`.

## Cache and rate limits

Upstash Redis provides distributed cache entries and rate-limit state. Cache keys are namespaced and expire. Cache failures may fail open for reconstructable reads; authentication, payment, AI, webhook, and other sensitive rate limits fail closed in production.

## Durable work

Inngest owns retriable and scheduled background work. Vercel Cron calls authenticated maintenance endpoints where direct scheduled HTTP execution is appropriate. Database uniqueness and ownership constraints make repeated execution safe.

## Storage

Supabase Storage contains trade images, weekly calendars, and feedback attachments. New object paths include the authenticated owner identifier. Public-to-private bucket transitions require object-reference storage, signed URL resolution, data migration, and rollback.

## Observability

Sentry receives scrubbed errors, release metadata, and server source maps. Application logs use the shared logger and exclude credentials and raw sensitive payloads. Health endpoints report database and Redis state without disclosing configuration values.

## Frontend delivery

Large dashboard features are route-local or lazy. Mobile widgets mount near the viewport and use bounded heights. Public source maps are disabled. Deterministic UI contracts protect shell routing, accessibility semantics, theme contrast, offline privacy, and mobile layout invariants.
