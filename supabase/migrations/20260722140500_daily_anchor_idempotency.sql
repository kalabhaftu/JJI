-- Rehearse on staging before production. Keep one canonical row per account/day,
-- then let concurrent cron/job attempts converge through ON CONFLICT.
DELETE FROM public."DailyAnchor" AS duplicate
USING public."DailyAnchor" AS keeper
WHERE duplicate."phaseAccountId" = keeper."phaseAccountId"
  AND duplicate."date" = keeper."date"
  AND duplicate."id" > keeper."id";
CREATE UNIQUE INDEX IF NOT EXISTS "DailyAnchor_phaseAccountId_date_key"
ON public."DailyAnchor" ("phaseAccountId", "date");
