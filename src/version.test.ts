import { describe, it, expect } from 'vitest';
import { versionStringToNumber, getMajorVersion } from './version';

describe('versionStringToNumber', () => {
  it('converts a standard semver string to a comparable number', () => {
    expect(versionStringToNumber('6.3.7')).toBe(60307);
  });

  it('handles leading zeros correctly via padStart', () => {
    expect(versionStringToNumber('1.0.0')).toBe(10000);
  });

  it('handles two-digit minor and patch versions', () => {
    expect(versionStringToNumber('10.12.99')).toBe(101299);
  });

  it('higher version produces higher number', () => {
    const v1 = versionStringToNumber('6.3.7');
    const v2 = versionStringToNumber('6.4.0');
    const v3 = versionStringToNumber('7.0.0');
    expect(v2).toBeGreaterThan(v1);
    expect(v3).toBeGreaterThan(v2);
  });

  it('same version produces equal numbers', () => {
    expect(versionStringToNumber('2.5.1')).toBe(versionStringToNumber('2.5.1'));
  });
});

describe('getMajorVersion', () => {
  it('returns the major version as a number', () => {
    expect(getMajorVersion('120.0.1')).toBe(120);
  });

  it('handles single-digit major version', () => {
    expect(getMajorVersion('6.0.0')).toBe(6);
  });

  it('handles version without minor and patch', () => {
    expect(getMajorVersion('15')).toBe(15);
  });

  it('returns 0 for empty string', () => {
    expect(getMajorVersion('')).toBe(0);
  });

  it('returns 0 for version starting with empty segment', () => {
    expect(getMajorVersion('.1.0')).toBe(0);
  });
});
