# JJI — Just Journal It

Production trading journal, performance analytics, prop-firm tracking, and consent-gated AI review workspace.

- Production: [www.justjournalit.site](https://www.justjournalit.site)
- Preview/pre-release: [justjournalit.vercel.app](https://justjournalit.vercel.app)
- Docs: [docs.justjournalit.site](https://docs.justjournalit.site)
- Staging branch: `preview`
- Production branch: `main`
- Runtime: Node.js 24
- Package manager: Bun (lockfile: `bun.lock`)

## Product

- Multi-account trade journal and calendar
- Dashboard widgets and reusable layouts
- Trade import, editing, grouping, tagging, export, and deletion
- Performance, risk, drawdown, session, and strategy reports
- Prop-firm challenges, phase evaluation, breaches, and payouts
- Daily notes, playbooks, goals, notifications, and shared reports
- Consent-gated AI conversations, insights, mappings, and weekly reviews
- Local demo mode under `/demo`

## System

| Area | Implementation |
|---|---|
| Web | Next.js 15 App Router, React 19, TypeScript |
| UI | Tailwind CSS, shadcn/ui primitives, Radix UI |
| Database | Supabase Postgres 17 |
| Data access | Drizzle ORM with PostgreSQL.js |
| Authentication | Supabase Auth |
| Storage | Supabase Storage |
| Cache and rate limits | Upstash Redis |
| Durable jobs | Inngest |
| Scheduled maintenance | Inngest cron and authenticated Vercel Cron |
| Error monitoring | Sentry |
| Payments | NOWPayments |
| Email | Resend |
| Hosting | Vercel |
| Tests | Vitest |

## Repository map

```text
app/                    Next.js routes, layouts, pages, and API handlers
components/             Shared product and UI components
context/                Client providers and product state
hooks/                  Client data and interaction hooks
lib/
  cache/                Upstash cache keys, cache-aside helpers, invalidation
  db/                   Drizzle client, schema, and relations
  inngest/              Inngest client and durable functions
  security/             Request, origin, import, export, and ownership guards
  services/             Domain services
server/                 Server-only domain and query modules
supabase/
  migrations/           Ordered production database migrations
  storage-policies.sql  Storage bucket and object policies
tests/                  Unit, integration, security, and UI contract tests
docs/                   Maintainer and operations documentation
```

## Local development

### Requirements

- Node.js 24
- Bun
- Supabase development project
- PostgreSQL pooled and direct connection strings

### Setup

```bash
git clone <repository-url>
bun install
cp .env.example .env.local
bun run dev
```

Open `http://localhost:3000`. `/demo` runs without authentication.

Environment variables are documented in [.env.example](.env.example). Keep credentials in local or managed environment storage. Never commit secrets.

## Commands

```bash
bun run dev                 Start the development server
bun run type-check          Run TypeScript validation
bun run lint                Run ESLint
bun test --run              Run all Vitest suites
bun run test:ui-contracts   Run deterministic UI and accessibility contracts
bun run security:scan-console
bun audit
bun run build               Build the production application
bun run build:analyze       Generate bundle analyzer reports
bun run db:generate         Generate a reviewed Drizzle migration
bun run db:studio           Open Drizzle Studio
```

`bun run db:push` is development-only. Production database changes use reviewed files under `supabase/migrations/`, staging rehearsal, backup, apply, and verification.

## Data boundaries

- Browser code uses Supabase Auth and owner-scoped Realtime reads.
- Application database reads and writes run through server routes and Drizzle.
- Protected queries include the authenticated internal user identifier.
- RLS is enabled as database defense in depth.
- Browser table writes are revoked.
- Storage writes use authenticated owner prefixes or the service role.
- Documents, API responses, and private media are not stored in shared service-worker caches.

## Production services

| Service | Required production configuration | Verification |
|---|---|---|
| Supabase | database, Auth, service role, Storage | migrations, advisors, RLS/policy inventory, two-user checks |
| Upstash | REST URL and token | PING, set/get, TTL, deletion, rate-limit behavior |
| Inngest | event key and signing key | endpoint sync, registered functions, signed execution, retry/failure checks |
| Sentry | DSN, org, project, release token | issue query, controlled event, release and source-map checks |
| Vercel | canonical URLs, service credentials, cron secret | preview build, health endpoints, production deployment |

## Release flow

1. Implement on `preview`.
2. Run type-check, lint, tests, audit, console scan, and production build.
3. Rehearse pending database and Storage migrations against staging.
4. Back up production and apply verified migrations.
5. Deploy and verify the production application and external services.
6. Merge `preview` into `main`.
7. Confirm the production deployment commit and clean branch state.

## Maintainer documentation

- [Repository instructions](AGENTS.md)
- [Documentation index](docs/index.md)
- [Architecture](docs/architecture.md)
- [Database and migrations](docs/database.md)
- [Production operations](docs/operations.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

## License

Copyright © 2025–present Just Journal It. All rights reserved.

This repository contains proprietary software. Use, copying, modification, and distribution require written authorization from the owner.
