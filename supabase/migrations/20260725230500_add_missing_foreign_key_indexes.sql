CREATE INDEX IF NOT EXISTS "PaymentRecord_promoCodeId_idx"
  ON "public"."PaymentRecord" ("promoCodeId");

CREATE INDEX IF NOT EXISTS "Subscription_promoCodeId_idx"
  ON "public"."Subscription" ("promoCodeId");

CREATE INDEX IF NOT EXISTS "Subscription_freeAccessId_idx"
  ON "public"."Subscription" ("freeAccessId");
