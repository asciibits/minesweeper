import { assert } from './assert.js';

/** Calculate nCk - ie n!/(k!*(n-k)!) */
export function combinations(n: number, k: number): bigint {
  assert(k <= n && n >= 0 && k >= 0);
  // use n-k if it's smaller than k; it yields the same result with fewer
  // // operations
  if (n - k < k) {
    k = n - k;
  }
  // short circuit for zero - it doesn't play well with the optimization below
  if (k === 0) {
    return 1n;
  }
  // To keep the values within reasonable range, arrange as alternating
  // multiplication and division. For example, 9C4 -> (9*8*7*6)/(4*3*2*1), is
  // rearranged to 9 / 1 * 8 / 2 * 7 / 3 * 6 / 2. Here  each step is guaranteed
  // to be an exact integer. Also, we skip the divide-by-one step.
  let c: bigint = BigInt(n);
  for (let m = c - 1n, l = 2n; l <= k; m--, l++) {
    c *= m;
    c /= l;
  }
  return c;
}

/**
 * If val is a bitmap of length n, with m bits set, then this method will return
 * the lexical ordering of val within the set of all possible such bitmaps.
 *
 * This is an O(n^2) operation, assuming bigint calculations on a value with
 * bitlength n is O(n)
 */
export function lexicalOrdering(val: bigint, n: number): bigint {
  assert(val >= 0, 'val must be positive');
  assert(n > 0, 'n must be positive');

  let lexical = 0n;
  let choices = 1n;
  let count = 0n;
  let marked = 0n;

  for (let i = 0; i < n; i++, val >>= 1n) {
    if (val & 1n) {
      lexical -= choices;
      choices *= ++count;
      choices /= ++marked;
      lexical += choices;
    } else {
      choices *= ++count;
      choices /= count - marked;
    }
  }
  assert(val === 0n, 'val out of range');
  return lexical;
}

/**
 * This is the inverse of the `lexicalOrdering` function. Return the bitmap of
 * size n with k bits set that is in the given lexical ordering.
 *
 * This is an O(n^2) operation, assuming bigint calculations on a value with
 * bitlength n is O(n)
 */
export function bitmapFromLexicalOrdering(
  lexical: bigint,
  n: number,
  k: number,
): bigint {
  let choices = combinations(n, k);
  assert(lexical >= 0n && lexical < choices, 'BoardNumber out of range');

  let count = BigInt(n);
  let marked = BigInt(k);

  let bitmap = 0n;

  for (let i = 0; i < n; i++) {
    bitmap <<= 1n;
    const nextChoiceIfNotSet = (choices * (count - marked)) / count;
    if (lexical < nextChoiceIfNotSet) {
      // not set
      choices = nextChoiceIfNotSet;
    } else {
      // set
      bitmap |= 1n;
      lexical -= choices;
      choices *= marked--;
      choices /= count;
      lexical += choices;
    }
    count--;
  }
  return bitmap;
}
