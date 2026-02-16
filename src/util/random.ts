import {assert} from './assert.js';

export interface BitSource {
  /**
   * Return the next set of random bits. This value must be a 32-bit unsigned
   * integer.
   */
  next(): number;
}

// export class RandomOrgBitSource implements BitSource {
//   const
//   constructor() {}
//   getLotsOfBits() {
//     const request = new XMLHttpRequest();
//     request.open(
//       'GET',
//       'https://www.random.org/cgi-bin/randbyte?nbytes=256&format=b',
//       false
//     );
//     request.send(null);
//     return request.responseText();
//   }
// }

/**
 * The default, high(er) quality source of randomness
 */
export class CryptoRandomBitSource implements BitSource {
  private readonly nextIntegers = new Uint32Array(16);
  private nextIndex = 16;
  next() {
    if (this.nextIndex >= this.nextIntegers.length) {
      crypto.getRandomValues(this.nextIntegers);
      this.nextIndex = 0;
    }
    return this.nextIntegers[this.nextIndex++];
  }
}

/**
 * Provide generalized random values from a bit source.
 */
export class Random {
  private workingBits = 0;
  private availableBits = 0;
  constructor(
    private readonly bitSource: BitSource = new CryptoRandomBitSource(),
  ) {}

  getRandomBits(bitCount: number): number {
    assert(
      bitCount >= 0 && bitCount <= 32,
      'Random bits must be between 0 and 32',
    );
    if (bitCount === 32) {
      // short-circuit the 32-bit request for both efficiency, and to elimintate
      // the concern about the shift operator being modded by 32
      return this.bitSource.next() >>> 0;
    }

    let result = 0;
    if (this.availableBits < bitCount) {
      // Grab the available bits for the high-order, then get more later for the
      // low-order
      result = this.workingBits << (bitCount - this.availableBits);
      bitCount -= this.availableBits;
      this.workingBits = this.bitSource.next() >>> 0;
      this.availableBits = 32;
    }

    result |= this.workingBits >>> (this.availableBits - bitCount);
    this.availableBits -= bitCount;
    this.workingBits &= (0x1 << this.availableBits) - 1;

    return result;
  }

  getRandomInteger(max: number, min = 0): number {
    assert(min <= max, 'Min must be <= max');
    max -= min;

    const bitCount = boundingLog2(max);
    let result: number;
    do {
      result = this.getRandomBits(bitCount);
    } while (result >= max);

    return result + min;
  }

  getRandomBigBits(bitLength: number): bigint {
    assert(bitLength >= 0, 'BitLength must be positive');
    let result = 0n;
    while (bitLength > 32) {
      result = (result << 32n) | BigInt(this.getRandomBits(32));
      bitLength -= 32;
    }
    result =
      (result << BigInt(bitLength)) |
      BigInt(this.getRandomBits(Number(bitLength)));
    return result;
  }

  getRandomBigInteger(
    max: bigint,
    min = 0n,
    allowImperfectDistribution = false,
  ): bigint {
    assert(min <= max, 'Min must be >= 0 and <= max');
    max -= min;

    const bitCount = boundingLog2(max);
    let result: bigint;
    if (!allowImperfectDistribution) {
      do {
        result = this.getRandomBigBits(bitCount);
      } while (result >= max);
    } else {
      // Less than perfect distribution, but it never needs more bits. Unless
      // `max` is a perfect power of 2, this will favor some values over
      // others. Specifically, of the `max` values to be returned, their
      // likelihood of occurring is either 1/max or 2/max
      result =
        (this.getRandomBigBits(bitCount) * max) / (1n << BigInt(bitCount));
    }

    return result + min;
  }

  /**
   * Generates a random double using 52 bits, evenly distributed between zero
   * and one
   */
  getRandomDouble(): number {
    const b = new ArrayBuffer(8);
    const iv = new Uint32Array(b);
    iv[0] = this.getRandomBits(32);
    iv[1] = this.getRandomBits(20) | 0x3ff00000;
    return new Float64Array(b)[0] - 1.0;
  }
}

/**
 * Choose `count` random items from an array. Note: The provided `items` array
 * is itself reordered and trimmed to provided the seleciton. Callers should
 * make a copy if the original items needs to be preserved.
 *
 * Calling with `count` equal to `items.length` is a shuffle.
 */
export function choose<T>(
  items: T[],
  count = items.length,
  rand = random,
): T[] {
  for (let i = 0; i < count; i++) {
    const swapIdx = rand.getRandomInteger(items.length, i);
    if (i != swapIdx) {
      const temp = items[i];
      items[i] = items[swapIdx];
      items[swapIdx] = temp;
    }
  }
  items.length = count;
  return items;
}

const MAX_UINT32 = (1n << 32n) - 1n;

function boundingLog2(n: number | bigint): number {
  let c = 0;
  if (typeof n === 'bigint') {
    let t: bigint = n - 1n;
    while (t > MAX_UINT32) {
      c += 32;
      t >>= 32n;
    }
    n = Number(t);
  } else {
    n -= 1;
  }
  return c + (32 - Math.clz32(n));
}

/**
 * Useful for tests that initialize Javascripts standard seed
 */
export class RandomBitSource implements BitSource {
  private readonly random: () => number;
  constructor(seed?: number) {
    seed = (seed ?? Date.now()) & 0xffffffff;
    // only log this with node
    if (typeof process === 'object') {
      console.log('Using Test seed: %d', seed);
    }
    this.random = getRandomFunction(seed);
  }
  next() {
    return Math.trunc(this.random() * 0xffffffff);
  }
}

function getRandomFunction(seed: number): () => number {
  seed ^= 0xdeadbeef; // 32-bit seed with XOR value
  // Pad seed with Phi, Pi and E.
  // https://en.wikipedia.org/wiki/Nothing-up-my-sleeve_number
  const rand = sfc32(0x9e3779b9, 0x243f6a88, 0xb7e15162, seed);
  for (let i = 0; i < 15; i++) rand();
  return rand;
}

/**
 * From: https://github.com/bryc/code/blob/master/jshash/PRNGs.md
 */
function sfc32(a: number, b: number, c: number, d: number) {
  return (): number => {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

function jasmineSeed(): number | undefined {
  if (typeof jasmine === 'undefined') {
    return undefined;
  }
  let seed = jasmine?.getEnv()?.configuration()?.seed;
  if (!seed) return undefined;
  if (typeof seed === 'string') {
    seed = Number(seed);
  }
  return isNaN(seed) ? undefined : seed;
}

export const random = new Random();
export const testRandom = new Random(new RandomBitSource(jasmineSeed()));
