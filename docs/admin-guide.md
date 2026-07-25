# Admin Guide

Use the admin area for production operations, not routine personal trading workflow. Prefer small, reversible changes and check the matching data page after every major update.

## Overview
- Use **Site UI** toggles to hide or show global public buttons such as donate and feedback.
- Use **Broadcast** for short platform notices only. Keep messages actionable and avoid sending noisy updates.

## Users
- Review user account state, access, and profile health.
- Use this page before manually changing billing/access so you know which account is affected.

## Feedback
- Triage incoming user feedback.
- Reply when the user needs a response, then update status so old feedback does not look new.
- Delete only spam or entries that should not be retained.

## Production incidents
- Use Sentry as the source of truth for application errors.
- Correlate the Sentry event with the Vercel deployment, route, release, and request time.
- Resolve an issue only after the fix is deployed and the original signature is no longer occurring.

## Activity
- Audit important user/admin actions.
- Use it to answer who changed what and when before making another manual correction.

## Analytics
- Review product traffic, usage, browser/device split, and growth patterns.
- Use trends rather than single spikes unless an incident or campaign explains the spike.

## Widget Catalog
- **Visible** controls whether a widget is available in the dashboard widget library.
- **Recommended** boosts a widget in product-curated surfaces.
- **Premium** marks widgets that should be treated as paid functionality.
- Avoid hiding widgets that existing users rely on unless there is a migration path.

## Dashboard Presets
- Create curated dashboard layouts for users to adopt.
- Presets do not rewrite existing user-owned templates.
- Use clear names that describe the workflow, such as “Prop Firm Review” or “Daily Scalper”.

## Feature Controls
- Use for guarded platform features and rollout state.
- **Enabled** means the feature can run.
- **Internal** means keep it away from normal users while testing.
- Turn features off during incidents or when a rollout needs to pause.

## Data Quality
- Check analytics readiness and missing data coverage.
- Low stop-loss/R or MAE/MFE coverage means advanced analytics may look weak even if calculations are correct.
- Use this before changing analytics code or support messaging.

## Taxonomy
- Review symbols, tags, strategies, and cleanup candidates.
- Use it to understand messy user-entered labels before normalizing anything.

## Sharing Governance
- Controls default behavior for public report links.
- Disable public sharing during abuse, privacy incidents, or while report sharing is broken.
- Require expiration when public links should not remain accessible indefinitely.

## Donations
- Manage public donation addresses and networks.
- Keep inactive or outdated addresses hidden rather than deleting immediately if you still need audit context.

## Subscriptions
- Review and manually adjust subscription lifecycle state.
- Use manual activation/cancel/extend only when payment-provider state is known.

## Payments
- Inspect payment records and reconcile provider status.
- Sync individual users or payment records when provider webhooks lag or fail.

## Promo Codes
- Create discounts or access promos with bounded usage and dates.
- Prefer short-lived codes for campaigns and explicit max-use limits for public promotions.

## Free Access
- Grant temporary or permanent access outside normal billing.
- Use temporary access for support cases, testers, or goodwill credits.
- Use permanent access sparingly and document why in the reason field.
