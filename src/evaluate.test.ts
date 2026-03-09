import { describe, it, expect } from 'vitest';
import { evaluateRule } from './evaluate';
import type { EvaluationContext, FeatureRule } from './types';

const baseContext: EvaluationContext = {
  appVersion: '6.0.0',
  browserName: 'chrome',
  browserVersion: '120.0.0',
  userId: 'user-1',
};

describe('evaluateRule — empty rule', () => {
  it('returns true when the rule has no constraints', () => {
    expect(evaluateRule({}, baseContext)).toBe(true);
  });
});

describe('evaluateRule — app-version', () => {
  it('returns true when app version meets the minimum', () => {
    const rule: FeatureRule = { 'app-version': '6.0.0' };
    expect(evaluateRule(rule, { ...baseContext, appVersion: '6.0.0' })).toBe(true);
  });

  it('returns true when app version is higher than minimum', () => {
    const rule: FeatureRule = { 'app-version': '5.0.0' };
    expect(evaluateRule(rule, { ...baseContext, appVersion: '6.0.0' })).toBe(true);
  });

  it('returns false when app version is below minimum', () => {
    const rule: FeatureRule = { 'app-version': '7.0.0' };
    expect(evaluateRule(rule, { ...baseContext, appVersion: '6.0.0' })).toBe(false);
  });
});

describe('evaluateRule — browser', () => {
  it('returns true when browser matches and version is sufficient', () => {
    const rule: FeatureRule = { browser: { chrome: 110 } };
    expect(evaluateRule(rule, { ...baseContext, browserName: 'chrome', browserVersion: '120.0.0' })).toBe(true);
  });

  it('returns true when browser version equals the minimum', () => {
    const rule: FeatureRule = { browser: { chrome: 120 } };
    expect(evaluateRule(rule, { ...baseContext, browserName: 'chrome', browserVersion: '120.0.0' })).toBe(true);
  });

  it('returns false when browser version is below minimum', () => {
    const rule: FeatureRule = { browser: { chrome: 130 } };
    expect(evaluateRule(rule, { ...baseContext, browserName: 'chrome', browserVersion: '120.0.0' })).toBe(false);
  });

  it('returns false when browser name is not listed', () => {
    const rule: FeatureRule = { browser: { firefox: 100 } };
    expect(evaluateRule(rule, { ...baseContext, browserName: 'chrome' })).toBe(false);
  });

  it('returns true when browser object is empty (no restriction)', () => {
    const rule: FeatureRule = { browser: {} };
    expect(evaluateRule(rule, baseContext)).toBe(true);
  });
});

describe('evaluateRule — rollout', () => {
  it('returns false when rollout is 0', () => {
    const rule: FeatureRule = { rollout: 0 };
    expect(evaluateRule(rule, baseContext)).toBe(false);
  });

  it('returns false when rollout is negative', () => {
    const rule: FeatureRule = { rollout: -0.5 };
    expect(evaluateRule(rule, baseContext)).toBe(false);
  });

  it('returns true when rollout is 1 (100%)', () => {
    const rule: FeatureRule = { rollout: 1 };
    expect(evaluateRule(rule, baseContext)).toBe(true);
  });

  it('returns true when rollout is > 1', () => {
    const rule: FeatureRule = { rollout: 2 };
    expect(evaluateRule(rule, baseContext)).toBe(true);
  });

  it('uses userId as seed when userId is provided', () => {
    // hashToPercent("") = 0.5381
    // rollout 0.6 > 0.5381 → enabled
    const rule: FeatureRule = { rollout: 0.6 };
    expect(evaluateRule(rule, { ...baseContext, userId: '' })).toBe(true);
  });

  it('excludes user when their hash exceeds rollout', () => {
    // hashToPercent("") = 0.5381
    // rollout 0.5 <= 0.5381 → disabled
    const rule: FeatureRule = { rollout: 0.5 };
    expect(evaluateRule(rule, { ...baseContext, userId: '' })).toBe(false);
  });

  it('falls back to appVersion + browserName when userId is absent', () => {
    const ctx: EvaluationContext = {
      appVersion: '6.0.0',
      browserName: 'chrome',
      browserVersion: '120.0.0',
    };
    const rule: FeatureRule = { rollout: 1 };
    expect(evaluateRule(rule, ctx)).toBe(true);
  });
});

describe('evaluateRule — combined rules', () => {
  it('returns true only when all constraints pass', () => {
    const rule: FeatureRule = {
      'app-version': '5.0.0',
      browser: { chrome: 100 },
      rollout: 1,
    };
    expect(evaluateRule(rule, baseContext)).toBe(true);
  });

  it('returns false when app-version fails even if others pass', () => {
    const rule: FeatureRule = {
      'app-version': '99.0.0',
      browser: { chrome: 100 },
      rollout: 1,
    };
    expect(evaluateRule(rule, baseContext)).toBe(false);
  });

  it('returns false when browser fails even if others pass', () => {
    const rule: FeatureRule = {
      'app-version': '5.0.0',
      browser: { firefox: 100 },
      rollout: 1,
    };
    expect(evaluateRule(rule, baseContext)).toBe(false);
  });

  it('returns false when rollout fails even if others pass', () => {
    const rule: FeatureRule = {
      'app-version': '5.0.0',
      browser: { chrome: 100 },
      rollout: 0,
    };
    expect(evaluateRule(rule, baseContext)).toBe(false);
  });
});
