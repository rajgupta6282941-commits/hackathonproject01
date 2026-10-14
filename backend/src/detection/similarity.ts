import { normalizeComparable } from './normalize.js';

export function normalizedSimilarity(left: string, right: string): number {
  const a = normalizeComparable(left);
  const b = normalizeComparable(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length);

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= b.length; column += 1) {
      const old = previous[column];
      previous[column] = Math.min(previous[column] + 1, previous[column - 1] + 1, diagonal + (a[row - 1] === b[column - 1] ? 0 : 1));
      diagonal = old;
    }
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}
