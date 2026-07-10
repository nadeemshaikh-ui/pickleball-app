import { describe, it, expect } from 'vitest';
import { parseSpokenScore } from './voiceScore';

describe('parseSpokenScore', () => {
  it('parses "15 to 10"', () => {
    expect(parseSpokenScore('15 to 10')).toEqual([15, 10]);
  });

  it('parses "15-10"', () => {
    expect(parseSpokenScore('15-10')).toEqual([15, 10]);
  });

  it('parses "15 10"', () => {
    expect(parseSpokenScore('15 10')).toEqual([15, 10]);
  });

  it('returns null when fewer than 2 numbers are found', () => {
    expect(parseSpokenScore('fifteen')).toBeNull();
    expect(parseSpokenScore('15')).toBeNull();
  });

  it('returns null when more than 2 numbers are found', () => {
    expect(parseSpokenScore('court 1 15 to 10')).toBeNull();
  });

  it('returns null for unparseable input', () => {
    expect(parseSpokenScore('')).toBeNull();
    expect(parseSpokenScore('nice game')).toBeNull();
  });
});
