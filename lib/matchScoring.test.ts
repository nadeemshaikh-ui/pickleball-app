import { describe, it, expect } from 'vitest';
import { validateMatchScore } from './matchScoring';

describe('validateMatchScore', () => {
  it('rejects ties under every rule', () => {
    expect(validateMatchScore(10, 10, 'golden_14').valid).toBe(false);
    expect(validateMatchScore(15, 15, 'cap_16').valid).toBe(false);
    expect(validateMatchScore(16, 16, 'cap_17').valid).toBe(false);
  });

  describe('golden_14', () => {
    it('accepts a normal 15-point win', () => {
      expect(validateMatchScore(15, 9, 'golden_14').valid).toBe(true);
    });
    it('accepts the golden point at 14-14 -> 15-14', () => {
      expect(validateMatchScore(15, 14, 'golden_14').valid).toBe(true);
    });
    it('rejects anything past 15', () => {
      expect(validateMatchScore(21, 19, 'golden_14').valid).toBe(false);
    });
    it('rejects a non-15 winning score', () => {
      expect(validateMatchScore(11, 9, 'golden_14').valid).toBe(false);
    });
  });

  describe('cap_16', () => {
    it('accepts a clean win-by-2 at 15', () => {
      expect(validateMatchScore(15, 13, 'cap_16').valid).toBe(true);
    });
    it('rejects 15-14 (not a 2-point margin, not yet at cap)', () => {
      expect(validateMatchScore(15, 14, 'cap_16').valid).toBe(false);
    });
    it('accepts the cap at 16-14 (clean win-by-2 that happens to land on the cap)', () => {
      expect(validateMatchScore(16, 14, 'cap_16').valid).toBe(true);
    });
    it('accepts the golden finish at 16-15 (from a tied 15-15)', () => {
      expect(validateMatchScore(16, 15, 'cap_16').valid).toBe(true);
    });
    it('rejects anything past the 16 cap', () => {
      expect(validateMatchScore(17, 15, 'cap_16').valid).toBe(false);
    });
  });

  describe('cap_17', () => {
    it('accepts a clean win-by-2 at 15', () => {
      expect(validateMatchScore(15, 13, 'cap_17').valid).toBe(true);
    });
    it('accepts win-by-2 continuing to 16-14', () => {
      expect(validateMatchScore(16, 14, 'cap_17').valid).toBe(true);
    });
    it('rejects 16-15 (not 2-point margin, not yet at the 17 cap)', () => {
      expect(validateMatchScore(16, 15, 'cap_17').valid).toBe(false);
    });
    it('accepts the cap at 17-15 (clean win-by-2 landing on the cap)', () => {
      expect(validateMatchScore(17, 15, 'cap_17').valid).toBe(true);
    });
    it('accepts the golden finish at 17-16 (from a tied 16-16)', () => {
      expect(validateMatchScore(17, 16, 'cap_17').valid).toBe(true);
    });
    it('rejects anything past the 17 cap', () => {
      expect(validateMatchScore(18, 16, 'cap_17').valid).toBe(false);
    });
  });
});
