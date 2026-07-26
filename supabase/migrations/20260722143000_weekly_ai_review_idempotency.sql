-- Preserve the earliest review for each user/week, then make concurrent review
-- generation converge on one row.
DELETE FROM public."WeeklyAIReview" AS duplicate
USING public."WeeklyAIReview" AS keeper
WHERE duplicate."userId" = keeper."userId"
  AND duplicate."weekStart" = keeper."weekStart"
  AND duplicate."id" > keeper."id";
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyAIReview_userId_weekStart_key"
ON public."WeeklyAIReview" ("userId", "weekStart");
