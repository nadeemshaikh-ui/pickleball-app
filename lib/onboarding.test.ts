import { describe, it, expect } from 'vitest';
import { getInitialStep } from './onboarding';

describe('getInitialStep', () => {
  it('starts at the branch step for a user with no club', () => {
    expect(getInitialStep(false)).toBe('branch');
  });

  it('skips straight to the profile step for a user who already has a club', () => {
    expect(getInitialStep(true)).toBe('profile');
  });
});
