alter table "PaymentRecord"
  add column if not exists "whopMembershipId" text,
  add column if not exists "whopUserId" text,
  add column if not exists "whopPlanId" text,
  add column if not exists "whopProductId" text,
  add column if not exists "whopEnvironment" text;
