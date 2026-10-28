/**
 * Shallow, order-sensitive comparison for persisted entity arrays.
 * These records intentionally contain scalar fields; nested data should be
 * given an explicit comparator if the persistence schema ever changes.
 */
export function areRecordArraysEqual<T extends object>(left: readonly T[], right: readonly T[]): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;

  for (let index = 0; index < left.length; index += 1) {
    const leftRow = left[index] as unknown as Record<string, unknown>;
    const rightRow = right[index] as unknown as Record<string, unknown>;
    const keys = Object.keys(leftRow);
    if (keys.length !== Object.keys(rightRow).length) return false;
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(rightRow, key) || !Object.is(leftRow[key], rightRow[key])) return false;
    }
  }
  return true;
}
