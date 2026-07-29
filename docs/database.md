# Database and migrations

## Source of truth

- Drizzle schema: `lib/db/schema/`
- Drizzle configuration: `drizzle.config.ts`
- Production migration history: `supabase/migrations/`
- Storage policies: `supabase/storage-policies.sql`

Drizzle models application tables, columns, indexes, relations, and inferred types. Supabase migrations define ordered production changes and database security state.

## Connections

- `DATABASE_URL`: pooled serverless application connection
- `DIRECT_URL`: direct administrative connection for migration tooling

Application code uses `DATABASE_URL` through `lib/db/client.ts`. Migration and administrative work should use the direct connection where the selected tool requires it.

## Development workflow

1. Change the Drizzle schema.
2. Create the migration with `supabase migration new <name>`.
3. Review generated SQL and data effects.
4. Add explicit data-preservation SQL when required.
5. Run `bun run db:migrations:check`.
6. Run focused migration tests and the full test suite.

`bun run db:push` is limited to disposable development databases.

The `0000`–`0002` files are historical Drizzle baselines. Production records
them as superseded; `20260726004500_align_drizzle_runtime_schema.sql` performs
their safe, data-preserving runtime alignment. Never replay the baselines
against a populated database.

## Production workflow

1. Inspect current production migration history and schema.
2. Run Supabase security and performance advisors.
3. Create or refresh an isolated staging branch.
4. Rehearse every pending migration in order.
5. Verify row counts, duplicates, constraints, indexes, grants, RLS, policies, and application queries.
6. Record the production backup or restore point.
7. Apply the same ordered migrations to production.
8. Re-run verification queries and advisors.
9. Deploy compatible application code.
10. Record rollback status and migration identifiers.

## RLS model

- Public-schema application tables have RLS enabled.
- `anon` has no application-table privileges.
- `authenticated` has only the owner-scoped Realtime reads required by the product.
- Browser writes are revoked.
- Server application connections perform authorized reads and writes after route-level ownership validation.

## Storage policy model

- Trade images: public legacy reads; owner-prefixed authenticated writes
- Weekly calendars: public legacy reads; owner-prefixed authenticated writes
- Feedback attachments: compatibility public reads until the admin signed-URL cutover; owner-prefixed or service-role writes

The final private-media migration must update stored references and every reader before changing bucket visibility.

## Verification

Minimum checks after a migration:

```sql
select version, name
from supabase_migrations.schema_migrations
order by version;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
order by schemaname, tablename, policyname;

select schemaname, tablename, indexname
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;
```

Also run the API ownership matrix with two users and verify Realtime and Storage cannot cross tenant boundaries.

## Rollback

Prefer forward fixes for additive indexes, grants, and policies. Restore from the recorded backup for destructive or data-rewriting failures. Do not drop a new column, index, policy, or constraint until its production use and rollback impact are understood.
