import { supabase } from './supabase';

// Fail open on error (network blip, etc.) — never block a user out of the
// app because a completion check couldn't run. Worst case they see the
// wizard again next login, which is harmless.
export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_onboarding')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return true;
  return Boolean(data);
}

export async function markOnboardingComplete(userId: string): Promise<void> {
  const { error } = await supabase.from('user_onboarding').insert({ user_id: userId });
  if (error && error.code !== '23505') throw error; // duplicate insert is a no-op, not an error
}

export type OnboardingStep = 'branch' | 'create-club' | 'join-club' | 'join-request-profile' | 'profile' | 'tour' | 'done';

// Pure — decides which step a signed-in user with no completed-onboarding
// row should land on first. Someone who already belongs to a club (they
// closed the tab mid-wizard last time, or existed before this feature
// shipped and somehow has no user_onboarding row) skips straight to the
// profile step instead of being asked "new club or join?" again.
export function getInitialStep(hasClub: boolean): OnboardingStep {
  return hasClub ? 'profile' : 'branch';
}
