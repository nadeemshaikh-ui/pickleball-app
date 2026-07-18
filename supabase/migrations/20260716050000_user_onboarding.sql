-- The user_onboarding table was referenced by lib/onboarding.ts since the
-- onboarding wizard shipped but was never actually created in the live DB.
-- hasCompletedOnboarding() fails open on any query error (deliberate — see
-- that file's comment), so every single user has silently skipped the
-- wizard since launch. This migration is the entire fix; app code was
-- already correct.
create table user_onboarding (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  completed_at timestamptz not null default now()
);

alter table user_onboarding enable row level security;

create policy "user_onboarding self select" on user_onboarding
  for select using (auth.uid() = user_id);

create policy "user_onboarding self insert" on user_onboarding
  for insert with check (auth.uid() = user_id);
