import { describe, it, expect } from 'vitest';
import { hashToPercent } from './hash';

describe('hashToPercent', () => {
  it('returns a number in [0, 1)', () => {
    const strings = ['', 'user123', 'abc', 'test', 'a'.repeat(100)];
    for (const s of strings) {
      const result = hashToPercent(s);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(1);
    }
  });

  it('is deterministic — same input always returns the same value', () => {
    const seed = 'user-42';
    expect(hashToPercent(seed)).toBe(hashToPercent(seed));
  });

  it('produces different values for different inputs', () => {
    expect(hashToPercent('user1')).not.toBe(hashToPercent('user2'));
  });

  it('handles empty string', () => {
    // djb2("") = 5381, 5381 % 10000 / 10000 = 0.5381
    expect(hashToPercent('')).toBe(0.5381);
  });

  it('handles single character', () => {
    const result = hashToPercent('a');
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(1);
  });
});
