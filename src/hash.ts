/**
 * Stable string hash (djb2) for rollout percentage.
 * Returns a number in [0, 1).
 */
export function hashToPercent(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  const unsigned = hash >>> 0;
  return (unsigned % 10000) / 10000;
}
