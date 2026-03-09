import type { FeatureRule, EvaluationContext } from './types';
import { versionStringToNumber, getMajorVersion } from './version';
import { hashToPercent } from './hash';

/**
 * Evaluates a single feature rule: true = enabled, false = disabled.
 * Order: app-version -> browser -> rollout.
 */
export function evaluateRule(rule: FeatureRule, context: EvaluationContext): boolean {
  if (rule['app-version'] != null) {
    const appNum = versionStringToNumber(context.appVersion);
    const minNum = versionStringToNumber(rule['app-version']);
    if (appNum < minNum) return false;
  }

  if (rule.browser != null && Object.keys(rule.browser).length > 0) {
    const minBrowserVersion = rule.browser[context.browserName];
    if (minBrowserVersion == null) return false;
    const currentMajor = getMajorVersion(context.browserVersion);
    if (currentMajor < minBrowserVersion) return false;
  }

  if (rule.rollout != null) {
    if (rule.rollout <= 0) return false;
    if (rule.rollout < 1) {
      const seed = context.deviceId ?? context.appVersion + context.browserName;
      const p = hashToPercent(seed);
      if (p >= rule.rollout) return false;
    }
  }

  return true;
}
