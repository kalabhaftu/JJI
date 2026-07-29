# Audit and activity logging

`AuditLog` is the durable security and compliance trail for material mutations.
Required audit writes use the same database transaction as the mutation; a
failed required audit write rolls the mutation back.

`ActivityLog` is product-visible or operational history. It may be best-effort
and must not be treated as proof that a material mutation committed.

Audit records store identifiers and bounded before/after summaries. Credentials,
tokens, email addresses, journal or note content, request bodies, uploads, and
trade-image data are removed before persistence. Bulk work records one summary
event rather than one event per row.
