# JJI — Just Journal It

A trading journal and analytics app for tracking and reviewing your trades.

> **This is proprietary software.** The source is not publicly licensed. See [License](#license) below.

## What it does

- **Dashboard** — view your equity curve, daily PnL, drawdown, win rate, and profit factor across one or more accounts.
- **Calendar** — review each trading day: PnL, setups, trade count, and notes at a glance.
- **Journal** — log notes, setups, rules, and screenshots per trade or per day.
- **Prop firm tracking** — manage challenge phases, drawdown limits, profit targets, and payout eligibility.
- **Reports** — filter and export performance data by account, date range, symbol, or session.
- **Import/Export** — bring in trades via CSV or JSON; export your data at any time.
- **Goals** — set monthly targets (win rate, net PnL, etc.) and track progress.
- **AI workspace** — optional, consent-gated xAI analysis across selected trades, journals, and weekly reviews.
- **Demo mode** — fully functional demo at `/demo` using local mock data, no login required.

## Tech stack

| Layer | Tech |
|---|---|
| Runtime | Node.js 24 LTS |
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS, shadcn/ui, Framer Motion |
| Database | PostgreSQL via Supabase |
| ORM | Drizzle ORM |
| Auth | Supabase Auth (email + Google + Discord OAuth) |
| State | Zustand + TanStack Query + SWR |
| Jobs | Inngest and Vercel Cron (maintenance and account safeguards) |
| Payments | NOWPayments (crypto) |
| Error tracking | Sentry |
| Testing | Vitest (unit), Playwright (e2e) |
| Deployment | Vercel |

## Getting started locally

### Prerequisites

- Node.js 24
- npm
- A [Supabase](https://supabase.com) project (free tier is enough for dev)
- PostgreSQL connection strings from Supabase

### 1. Clone and install

```bash
git clone <repository-url>
cd <project-directory>
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in the required values:

```bash
cp .env.example .env.local
```

Minimum variables needed to run locally:

```env
DATABASE_URL=             # Supabase pooled connection string (pgBouncer)
DIRECT_URL=               # Supabase direct connection string (for migrations)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_SECRET=          # Any random 32+ character string
```

Everything else in `.env.example` (payments, AI, Sentry, etc.) is optional for local development.

### 3. Set up the database

Generate or push the Drizzle schema to a development Supabase project:

```bash
npm run db:generate   # generate migration files
npm run db:push       # apply schema to the database
```

You also need to apply the Supabase storage policies from `supabase/storage-policies.sql` in the Supabase SQL editor.

Timestamped SQL migrations in `supabase/migrations/` must be rehearsed against a staging clone before production. The server-only RLS migration intentionally preserves owner-scoped `SELECT` access for the tables used by Supabase Realtime while keeping browser writes revoked.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You can use the app at `/demo` without any auth or DB.

## Useful commands

```bash
npm run dev              # start dev server (localhost:3000)
npm run type-check       # TypeScript check
npm run lint             # ESLint
npm test -- --run        # run Vitest tests once
npm run test:e2e         # Playwright end-to-end tests
npm run db:studio        # open Drizzle Studio to inspect the DB
npm run lint:fix         # auto-fix lint issues
```

## Project layout

```
app/                    # Next.js App Router pages and layouts
  (auth)/               # sign-in, sign-up, reset password
  dashboard/            # main app (requires auth)
  demo/                 # demo mode (no auth, all data is local mock)
  api/v1/               # REST API routes
components/             # shared React components
context/                # React context providers
hooks/                  # data-fetching hooks (TanStack Query, SWR)
lib/                    # utilities, analytics calculations, DB client
  db/                   # Drizzle schema and migrations
  demo/                 # mock data for demo mode
  security/             # CORS, origin validation, CSP helpers
public/                 # static assets, PWA manifest, service worker
tests/                  # Vitest unit tests and security tests
```

## Demo mode

Demo mode (`/demo`) runs entirely in the browser. A fetch interceptor (`app/demo/components/demo-network-interceptor.tsx`) catches all `/api/v1/*` calls and returns mock data. No database connection or auth token is needed.

## Security notes

- Never commit real secrets. Use `.env.local` for local development.
- Protected APIs resolve the Supabase session and enforce ownership again in Drizzle queries. RLS is an additional database boundary; authenticated browser access is limited to owner-scoped Realtime reads.
- The `supabase/storage-policies.sql` file defines bucket access policies. Review and apply them before deploying.
- CORS is configured in `lib/security/origins.ts`. The production origin is `https://justjournalit.vercel.app`.
- A cron secret (`CRON_SECRET`) is required in production for scheduled maintenance jobs.

## Environment variables reference

See `.env.example` for the full list with descriptions. Key groups:

| Group | Variables |
|---|---|
| Database | `DATABASE_URL`, `DIRECT_URL` |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| App URLs | `APP_BASE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL` |
| Auth | `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `DISCORD_CLIENT_ID/SECRET` |
| Payments | `NOWPAYMENTS_*` |
| AI | `XAI_API_KEY`, `XAI_MODEL` |
| Background jobs | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` |
| Cron | `CRON_SECRET` |
| Email | `RESEND_API_KEY` |
| Error tracking | `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` |

## Deployment

The app is deployed on Vercel. Push to `main` triggers a production deploy. The `preview` branch is used for staging.

Production URL: `https://justjournalit.vercel.app`  
Support: `justjournalit1@gmail.com`

## License

Copyright © 2025–present Just Journal It. All rights reserved.

This software is proprietary. You may not copy, distribute, modify, or use this code without explicit written permission from the authors. No open-source license is granted.
