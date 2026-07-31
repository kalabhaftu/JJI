# Whop Integration Documentation

This document describes the architecture and setup instructions for the Whop payment provider integration in JJI.

## Architecture

Whop serves as a secondary card payment provider alongside the original NOWPayments crypto integration. 

- **State mapping:** Whop membership webhooks map directly to the existing `Subscription` table statuses (`active`, `past_due`, `expired`, etc).
- **Entitlement:** The existing `getUserAccessStatus` correctly handles access checking against the `Subscription` table, meaning Whop required zero changes to entitlement logic.
- **Idempotency:** Webhook requests are logged to `WhopWebhookEvent` (unique by `eventId`) before processing. This ensures at-most-once execution even if Whop retries.

## Whop Seller Dashboard Setup

1. Create a Product in the Whop Seller Dashboard.
2. Create a Plan within the Product (e.g. $10/month recurring).
3. Under the Developer tab, configure a new webhook:
   - Endpoint URL: `https://your-domain.com/api/v1/payments/whop-webhook`
   - Select events: `membership.activated`, `membership.deactivated`, `membership.cancel_at_period_end_changed`, `membership.trial_ending_soon`, `payment.created`, `payment.pending`, `payment.failed`, `payment.succeeded`.
4. Copy the Developer API Key and Webhook Secret.

## Environment Variables

| Variable | Requirement | Purpose |
|----------|-------------|---------|
| `WHOP_API_KEY` | Required | Backend API operations (reconciliation) |
| `WHOP_WEBHOOK_SECRET` | Required | HMAC-SHA256 verification of webhooks |
| `WHOP_PLAN_ID_PRO` | Required | The ID of the plan to use at checkout (e.g., `plan_xxxx`) |
| `WHOP_ENVIRONMENT` | Optional | `sandbox` or `production` (default: `sandbox`) |

## Testing

Run unit tests and verification with:
```bash
bun test tests/unit/whop/
bun run type-check
```

## Rollback Procedure

If the Whop integration must be disabled:
1. Remove the "Pay with Card" button from `app/subscribe/subscribe-client.tsx`.
2. Remove the Whop configuration from `.env`. (The client will crash on startup if the env vars are missing, so ensure they are also removed from `client.ts` if a full rollback is required).
