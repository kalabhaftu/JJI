# Whop card subscriptions

Whop provides recurring card billing alongside the existing NOWPayments crypto
flow. Whop never replaces the local `Subscription` entitlement record:
provider membership state is synchronized into it, and all authorization keeps
using the existing server-side access service.

## Request and event flow

1. An authenticated, payment-rate-limited request creates a typed Whop checkout
   configuration for `WHOP_PLAN_ID_PRO`.
2. The checkout carries only internal correlation metadata and redirects to the
   existing subscription success page.
3. `/api/v1/payments/whop-webhook` verifies the Standard Webhooks signature on
   the raw body, stores a payload hash and minimal event metadata, and enqueues
   an Inngest event. Raw webhook bodies, emails, card data, and billing addresses
   are not persisted.
4. Inngest retrieves the authoritative membership or payment from Whop, then
   transactionally updates `WhopMembership`, `Subscription`, `PaymentRecord`,
   and `AuditLog`.
5. Notifications and the idempotent Resend welcome email run only after the
   durable state commits. Failed jobs remain retryable and stale inbox leases
   are recovered by scheduled reconciliation.

Dispute and resolution-center events create a Sentry manual-review signal. They
do not automatically ban a user or revoke access. Entitlement changes only from
authoritative Whop membership state.

## Provider configuration

Configure separate Whop projects and credentials for preview and production.
Never accept sandbox signatures in production or mix a sandbox API key with the
production API URL.

The subscribe page derives card-checkout availability on the server from a
complete, valid Whop configuration. Empty or cross-environment variables hide
only the card option; NOWPayments remains available while provider setup is
repaired.

| Variable | Meaning |
|---|---|
| `WHOP_API_KEY` | Server-only company API key for the selected environment |
| `WHOP_WEBHOOK_SECRET` | Secret for the webhook in the same environment |
| `WHOP_PLAN_ID_PRO` | Existing recurring `plan_...` ID, or a matching-environment Whop checkout URL containing that ID |
| `WHOP_ENVIRONMENT` | `sandbox` on preview, `production` on main |

Webhook URL: `https://<environment-host>/api/v1/payments/whop-webhook`.
Use Whop API version `v1` and subscribe to membership, payment, refund,
dispute, dispute-alert, and resolution-center lifecycle events.

Required key permissions: checkout configuration creation, membership read and
cancellation, payment read, and refund read. Use the narrowest Whop role that
provides those permissions.

## Verification and rollout

1. Preserve the production-history `0004_add_ban_columns` marker, then apply the
   timestamped Supabase migration to staging. Never apply the conflicting
   generated `0004_whop_integration` migration.
2. Configure preview with sandbox credentials and sync the Inngest functions.
3. Create one sandbox card checkout and verify the response request ID, webhook
   inbox row, Inngest run, subscription/payment/audit rows, Resend delivery, and
   Sentry privacy.
4. Send the same webhook twice and verify one durable outcome; force one job
   failure and verify retry recovery.
5. Confirm dispute events only raise manual review and do not change access.
6. Record the production restore point, apply the migration, configure production
   credentials, deploy, then repeat a controlled production-safe verification.

Rollback the application by promoting the prior deployment. The migration is
additive; retain its tables for evidence and roll forward rather than dropping
billing records during an incident.

## Main-branch reconciliation

The Whop work formerly committed directly to `main` was reviewed commit by
commit. `preview` remains the architectural source; the histories must be
joined with a tree-preserving merge only after this implementation is committed.
A normal merge or rebase would restore reverted monoliths and obsolete tooling.

| Main work | Decision in the preview implementation |
|---|---|
| Initial checkout and webhook integration | Reimplemented with the current SDK, API envelope, request IDs, rate policy, durable inbox, and Inngest processing. |
| Direct plan URLs | Normalized to their embedded `plan_...` ID only when the Whop host matches the configured environment; the application never redirects to the configured URL directly. |
| Success redirect and welcome email | Preserved with provider-aware polling and idempotent Resend delivery after durable activation. |
| Production acceptance of sandbox signatures | Rejected. Preview and production use separate credentials and webhook secrets. |
| Email fallback identity matching | Rejected. Memberships map only through checkout metadata or an existing durable membership link. |
| Dynamic environment reads | Preserved through lazy validated configuration; missing provider variables do not break unrelated routes at import time. |
| ISO membership dates | Preserved with validated date parsing. |
| Direct Sentry capture | Replaced by the canonical scrubbed reporter and request correlation. |
| User ban columns and punitive dispute copy | Existing production columns remain modeled only for migration parity; no policy reads or writes them. Disputes create a manual-review signal and never automatically ban or revoke access. |
| Package override and broad branch-revert commits | Rejected as unrelated or regressive. Existing preview dependency and architecture work stays intact. |
| Demo/docs routing | Already present in preview and therefore not ported a second time. |
