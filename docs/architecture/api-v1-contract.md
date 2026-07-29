# API v1 contract

`/api/v1` uses HTTP status as the authoritative result and returns the request
correlation ID in both `x-request-id` and the JSON body.

Success:

```json
{
  "success": true,
  "data": {},
  "message": "Optional",
  "meta": {},
  "requestId": "..."
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "STABLE_MACHINE_CODE",
    "message": "Safe user-facing message",
    "details": {}
  },
  "requestId": "..."
}
```

`details` is limited to safe validation metadata. Internal exceptions, request
bodies, credentials, private journal/trade content, and provider payloads must
never be serialized.

Protocol-controlled endpoints keep their provider-defined bodies: auth
callbacks, signed webhooks, Inngest, cron, health, redirects, streams, and file
downloads. They still receive `x-request-id` and structured error reporting.

This envelope is an intentional in-place v1 contract change. A route family and
all repository callers must migrate together. Browser code uses
`lib/api/client.ts`, which temporarily reads both the former string error and
the canonical nested error during the staged migration.
