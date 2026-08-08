# Authentication, dashboard bootstrap, and logout

## Dashboard request sequence

Protected dashboard requests use a staged flow:

1. `proxy.ts` refreshes the Supabase SSR session and uses `getClaims()` to identify authenticated requests.
2. `getDashboardAccess()` performs the fast server-side authentication, internal-user, and subscription checks.
3. `getDashboardBootstrapData()` loads the user, canonical accounts, prop-firm phases, grouped trade counts, settings, and active template for the dashboard layout.
4. The client reconciles saved account-filter selections against the canonical account IDs.
5. Trade, aggregate, and prop-firm detail queries start only after that reconciliation completes.

The dashboard loading frame remains visible until bootstrap, account-filter settings, primary trade data, and aggregates are ready. Empty-account and empty-trade states are not valid loading states.

The old `/api/v1/init` route was removed. It duplicated the server-owned layout bootstrap and could race the dashboard queries. The server bootstrap function remains the single initial data source.

## Logout

`POST /api/auth/logout` invalidates the current Supabase session locally. `POST /api/auth/logout-all` requests global Supabase sign-out for the explicit “Sign out all devices” action. Both routes require same-origin request metadata, propagate Supabase cookie updates, return `204`, and use `Cache-Control: no-store`.

The browser marks the app as signing out before the request, clears JJI-scoped client state, and navigates to `/` after the response. A fetch-followed redirect is not used as the browser navigation mechanism.

Supabase access tokens can remain cryptographically valid until their expiry even after global sign-out. Sensitive operations must continue to enforce their server-side authorization checks; logout is not a substitute for per-request authorization.

## Auth callback origins

Production authentication callbacks use `https://www.justjournalit.site`. The preview environment uses its approved Vercel preview host. Generated deployment URLs are never selected as the production callback origin, and validated internal `next` paths are preserved without allowing external redirects.
