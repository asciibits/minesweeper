import { BitSource, Random, choose, testRandom } from './random.js';

describe('Random', () => {
  class TestRandomBitSource implements BitSource {
    private idx = 0;
    constructor(private readonly randomBits: number[]) {}
    next() {
      return this.randomBits[this.idx++ % this.randomBits.length];
    }
  }
  describe('getRandomBits', () => {
    it('returns the 32-bit value unchanged', () => {
      expect(new Random(new TestRandomBitSource([13])).getRandomBits(32)).toBe(
        13,
      );
      expect(new Random(new TestRandomBitSource([-1])).getRandomBits(32)).toBe(
        0xffffffff,
      );
    });
    it('uses one random for multiple sets of bits', () => {
      const r = new Random(new TestRandomBitSource([0xcafe1234]));
      expect(r.getRandomBits(4)).toBe(0xc);
      expect(r.getRandomBits(4)).toBe(0xa);
      expect(r.getRandomBits(4)).toBe(0xf);
      expect(r.getRandomBits(4)).toBe(0xe);
      expect(r.getRandomBits(4)).toBe(0x1);
      expect(r.getRandomBits(4)).toBe(0x2);
      expect(r.getRandomBits(4)).toBe(0x3);
      expect(r.getRandomBits(4)).toBe(0x4);
    });
    it('uses the remaining bits for next random', () => {
      const r = new Random(new TestRandomBitSource([0xcafebabe, 0xbeef0000]));
      expect(r.getRandomBits(20)).toBe(0xcafeb);
      expect(r.getRandomBits(28)).toBe(0xabebeef);
    });
  });
  describe('getRandomBigBits', () => {
    it('returns the 32-bit value unchanged', () => {
      expect(
        new Random(new TestRandomBitSource([13])).getRandomBigBits(32n),
      ).toBe(13n);
      expect(
        new Random(new TestRandomBitSource([-1])).getRandomBigBits(32n),
      ).toBe(0xffffffffn);
    });
    it('uses one random for multiple sets of bits', () => {
      const r = new Random(new TestRandomBitSource([0xcafe1234]));
      expect(r.getRandomBigBits(4n)).toBe(0xcn);
      expect(r.getRandomBigBits(4n)).toBe(0xan);
      expect(r.getRandomBigBits(4n)).toBe(0xfn);
      expect(r.getRandomBigBits(4n)).toBe(0xen);
      expect(r.getRandomBigBits(4n)).toBe(0x1n);
      expect(r.getRandomBigBits(4n)).toBe(0x2n);
      expect(r.getRandomBigBits(4n)).toBe(0x3n);
      expect(r.getRandomBigBits(4n)).toBe(0x4n);
    });
    it('uses the remaining bits for next random', () => {
      const r = new Random(new TestRandomBitSource([0xcafebabe, 0xbeef0000]));
      expect(r.getRandomBigBits(20n)).toBe(0xcafebn);
      expect(r.getRandomBigBits(28n)).toBe(0xabebeefn);
    });
    it('combines values to create bigints', () => {
      const r = new Random(
        new TestRandomBitSource([0xcafebabe, 0xdeadbeef, 0xba5eba11]),
      );
      expect(r.getRandomBigBits(52n)).toBe(0xcafebabedeadbn);
      expect(r.getRandomBigBits(40n)).toBe(0xba5eba11een);
    });
  });
  describe('getRandomInteger', () => {
    it('uses getRandomBits for powers of 2', () => {
      const r = new Random(new TestRandomBitSource([0xcafe1234]));
      expect(r.getRandomInteger(16)).toBe(0xc);
      expect(r.getRandomInteger(16)).toBe(0xa);
      expect(r.getRandomInteger(16)).toBe(0xf);
      expect(r.getRandomInteger(16)).toBe(0xe);
      expect(r.getRandomInteger(16)).toBe(0x1);
      expect(r.getRandomInteger(16)).toBe(0x2);
      expect(r.getRandomInteger(16)).toBe(0x3);
      expect(r.getRandomInteger(16)).toBe(0x4);
    });
    it('uses the next highest powers of 2 for others', () => {
      const r = new Random(new TestRandomBitSource([0xcafe1234]));
      expect(r.getRandomInteger(15)).toBe(0xc);
      expect(r.getRandomInteger(15)).toBe(0xa);
      // 15 is out of bounds - it is skipped when getting a random # < 15
      // expect(r.getRandomInteger(15)).toBe(0xF);
      expect(r.getRandomInteger(15)).toBe(0xe);
      expect(r.getRandomInteger(15)).toBe(0x1);
      expect(r.getRandomInteger(15)).toBe(0x2);
      expect(r.getRandomInteger(15)).toBe(0x3);
      expect(r.getRandomInteger(15)).toBe(0x4);
    });
    it('skips up to half the values', () => {
      const r = new Random(new TestRandomBitSource([0xcafe1234]));
      // The values over 8 are skipped
      // expect(r.getRandomInteger(9)).toBe(0xC);
      // expect(r.getRandomInteger(9)).toBe(0xA);
      // expect(r.getRandomInteger(9)).toBe(0xF);
      // expect(r.getRandomInteger(9)).toBe(0xE);
      expect(r.getRandomInteger(9)).toBe(0x1);
      expect(r.getRandomInteger(9)).toBe(0x2);
      expect(r.getRandomInteger(9)).toBe(0x3);
      expect(r.getRandomInteger(9)).toBe(0x4);
    });
    it('Uses the minimum value as well', () => {
      const r = new Random(new TestRandomBitSource([0xcafe1234]));
      expect(r.getRandomInteger(32, 16)).toBe(0x1c);
      expect(r.getRandomInteger(32, 16)).toBe(0x1a);
      expect(r.getRandomInteger(32, 16)).toBe(0x1f);
      expect(r.getRandomInteger(32, 16)).toBe(0x1e);
      expect(r.getRandomInteger(32, 16)).toBe(0x11);
      expect(r.getRandomInteger(32, 16)).toBe(0x12);
      expect(r.getRandomInteger(32, 16)).toBe(0x13);
      expect(r.getRandomInteger(32, 16)).toBe(0x14);
    });
  });
  describe('getRandomDouble', () => {
    it('returns zero exactly when source bits are zero', () => {
      const r = new Random(new TestRandomBitSource([0]));
      expect(r.getRandomDouble()).toBe(0);
    });
    it('returns 0.5 exactly when source bits have a single leading 1', () => {
      const r = new Random(new TestRandomBitSource([0, 0x80000000]));
      expect(r.getRandomDouble()).toBe(0.5);
    });
    it('preserves all provided bits exactly', () => {
      const r = new Random(new TestRandomBitSource([0xcafebabe, 0x7dead000]));
      const v = r.getRandomDouble();
      expect(v.toString(16)).toBe('0.7deadcafebabe');
    });
  });
});
// fdescribe('testRandom', () => {
//   it('returns reasonable random numbers', () => {
//     for (let mul = 2; mul < 58; mul++) {
//       let count = 0;
//       const buckets = new Array(mul).fill(0);
//       bucketing: for (;;) {
//         const next = testRandom.getRandomBits(32);
//         for (let i = Math.trunc(32 / Math.log2(mul)) - 1; i >= 0; i--) {
//           buckets[next % mul]++;
//           if (++count >= mul * 500) {
//             break bucketing;
//           }
//         }
//       }
//       // each bucket should have a values of ~500 - verify they all have at
//       // least 300
//       for (let i = 0; i < buckets.length; i++) {
//         if (buckets[i] < 300) {
//           console.log('Not enough buckets:\n%o', { mul, buckets });
//           throw new Error('Not enough samples. See logs');
//         }
//       }
//     }
//   });
// });

describe('choose', () => {
  it('shuffles a list', () => {
    const list = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = choose([...list], list.length, testRandom);
    expect(shuffled.length).toBe(list.length);
    expect(shuffled).not.toEqual(list);
    for (let i = 1; i <= list.length; i++) {
      expect(shuffled).toContain(i);
    }
  });
  it('randomizes the first part of a list', () => {
    const list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = choose([...list], 5, testRandom);
    expect(shuffled.length).toBe(5);
    shuffled.sort();
    for (let i = 1; i < shuffled.length; i++) {
      expect(shuffled[i]).not.toBe(shuffled[i - 1]);
      expect(shuffled[i]).toBeGreaterThanOrEqual(1);
      expect(shuffled[i]).toBeLessThanOrEqual(list.length);
    }
  });
});
