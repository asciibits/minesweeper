import { BitSet, BitSetWriter, BitReader } from './io.js';

export function cleanState<T extends Record<string, unknown>>(
  init: () => T
): T {
  const state = {} as unknown as T;
  beforeEach(() => {
    // clear state before every test case.
    for (const prop of Object.getOwnPropertyNames(state)) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      delete (state as { [k: string]: any })[prop];
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }
    Object.assign(state, init());
  });
  return state;
}

/** Function to easily create a bitset from a variety of sources */
export function bitset(
  digits: number[],
  bitsPerDigit: number,
  bitCount?: number
): BitSet;
export function bitset(
  source: BitReader | number | bigint,
  bitCount?: number
): BitSet;
export function bitset(
  source: BitReader | number | bigint | number[],
  bitsOrBitCount?: number,
  bitCount?: number
): BitSet {
  let bitset: BitSet;
  if (Array.isArray(source)) {
    const bitsPerDigit = bitsOrBitCount;
    const writer = new BitSetWriter();
    for (const digit of source) {
      writer.writeBatch(digit, bitsPerDigit);
    }
    bitset = writer.bitset;
  } else {
    bitCount = bitsOrBitCount;
    if (typeof source === 'number') {
      bitset = new BitSetWriter().writeBatch(source).bitset;
    } else if (typeof source === 'bigint') {
      bitset = new BitSetWriter().writeBigBits(source).bitset;
    } else {
      // source instanceof Reader
      bitset = BitSet.fromReader(source, bitCount);
    }
  }
  if (bitCount !== undefined) {
    bitset.length = bitCount;
  }
  return bitset;
}
