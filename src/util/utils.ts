/**
 * @fileoverview Utilities
 */

/**
 * Reverse the bits of a 32-bit value. For details, see
 * https://graphics.stanford.edu/~seander/bithacks.html#ReverseParallel
 */
export function reverseBits(v: number): number {
  let r = v;
  let s = 31;

  for (v >>>= 1; v; v >>>= 1) {
    r <<= 1;
    r |= v & 1;
    s--;
  }
  r <<= s;
  return r;
}

/** Count the number of '1' bits in a 32-bit value. For details, see:
 * https://graphics.stanford.edu/~seander/bithacks.html#CountBitsSetParallel
 */
export function countBits(v: number): number {
  v = (v >>> 0) - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

export interface HasLength {
  readonly length: number;
}

export type IterType<T> = (Iterable<T> | Iterator<T>) & Partial<HasLength>;

export function isIterator<T>(input: IterType<T>): input is Iterator<T> {
  return !!(input as Iterator<T>).next;
}
export function isIterable<T>(input: IterType<T>): input is Iterable<T> {
  return !!(input as Iterable<T>)[Symbol.iterator];
}

export function asIterator<T>(
  iter: IterType<T>,
): Iterator<T> & Partial<HasLength> {
  return isIterator(iter)
    ? iter
    : Object.assign(iter[Symbol.iterator](), { length: iter.length });
}

export function asIterable<T>(
  iter: IterType<T>,
): Iterable<T> & Partial<HasLength> {
  return isIterable(iter)
    ? iter
    : { [Symbol.iterator]: () => iter, length: iter.length };
}

export function padLeft(s: string, c: string, len: number): string {
  return s.length < len ? c.charAt(0).repeat(len - s.length) + s : s;
}
