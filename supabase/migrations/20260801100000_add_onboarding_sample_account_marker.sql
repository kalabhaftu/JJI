alter table public."Account"
  add column if not exists "isOnboardingSample" boolean not null default false;

create index if not exists "account_user_onboarding_sample_idx"
  on public."Account" ("userId", "isOnboardingSample")
  where "isOnboardingSample" = true;
