DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'WeeklyAIReview'
      AND column_name = 'focusNextWeek'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'WeeklyAIReview'
      AND column_name = 'focus_next_week'
  ) THEN
    ALTER TABLE public."WeeklyAIReview"
      RENAME COLUMN "focusNextWeek" TO "focus_next_week";
  END IF;
END
$$;
ALTER TABLE public."WeeklyAIReview"
  ALTER COLUMN "weekStart" TYPE timestamp with time zone
    USING "weekStart"::timestamp AT TIME ZONE 'UTC',
  ALTER COLUMN "weekEnd" TYPE timestamp with time zone
    USING "weekEnd"::timestamp AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE timestamp with time zone
    USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" SET DEFAULT now();
