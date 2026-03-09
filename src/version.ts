/**
 * Converts a version string to a comparable number (e.g. "6.3.7" -> 60307).
 */
export function versionStringToNumber(version: string): number {
  return Number(
    version
      .split('.')
      .map((segment) => segment.padStart(2, '0'))
      .join(''),
  );
}

/**
 * Returns major version from string (e.g. "120.0.1" -> 120).
 */
export function getMajorVersion(version: string): number {
  const major = version.split('.')[0];
  return parseInt(major || '0', 10);
}
