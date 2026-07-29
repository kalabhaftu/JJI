# Database migrations

`supabase/migrations` is the only executable production migration history.
Production deployment must not use `drizzle-kit migrate` or `drizzle-kit push`.
Drizzle schema files remain the application type/schema model and must change in
the same commit as each Supabase migration.

## Workflow

1. Create an imperative migration with `supabase migration new <name>`.
2. Edit and review the generated SQL file.
3. Update the matching Drizzle schema.
4. Run `bun run db:migrations:check`.
5. Rehearse locally or in staging, then run migration list, a push dry-run, and
   database advisors.
6. Confirm a backup or restore point before an approved production push.

Never repair remote migration history unless `supabase migration list --linked`
proves a mismatch and the repair has received a separate review. The four
legacy Drizzle-journaled migrations remain historical records; new production
migrations use Supabase timestamp names.
