import {
  BitSet,
  BitSetWriter,
  BitSourceReader,
  BitReader,
  biterator,
  concatenateReaders,
  interator,
} from './io.js';
import { testRandom } from './random.js';
import { bitset } from './test_utils.js';

describe('BitSet', () => {
  describe('Single Bit Operations', () => {
    it('updates length when setting bits', () => {
      const bitSet = new BitSet();
      expect(bitSet.length).toBe(0);
      bitSet.setBit(1, 1);
      expect(bitSet.length).toBe(2);
      bitSet.setBit(10, 0);
      expect(bitSet.length).toBe(11);
    });
    it('returns bits set', () => {
      const bitSet = new BitSet();
      expect(bitSet.getBit(0)).toBe(0);
      bitSet.setBit(0, 1);
      expect(bitSet.getBit(0)).toBe(1);
      bitSet.setBit(0, 0);
      expect(bitSet.getBit(0)).toBe(0);

      expect(bitSet.getBit(100)).toBe(0);
      bitSet.setBit(100, 1);
      expect(bitSet.getBit(100)).toBe(1);
      bitSet.setBit(100, 0);
      expect(bitSet.getBit(100)).toBe(0);
    });
    it('clears bits when decreasing length', () => {
      const bitSet = new BitSet();
      bitSet.setBit(100, 1);
      // decreasing the length should clear the 100th bit
      bitSet.length = 100;
      expect(bitSet.getBit(100)).toBe(0);
      // and it should still be clear when the buffer grows
      bitSet.length = 101;
      expect(bitSet.getBit(100)).toBe(0);

      // try again, but with the length going low enough to impact the full buffer
      // byte
      bitSet.setBit(100, 1);
      bitSet.length = 50;
      bitSet.length = 101;
      expect(bitSet.getBit(100)).toBe(0);
    });
    it('sets and gets single bits', () => {
      const bitSet = new BitSet();
      bitSet.setBit(69, 1);
      bitSet.setBit(59, 1);
      bitSet.setBit(49, 1);
      bitSet.setBit(39, 1);
      bitSet.setBit(29, 1);
      bitSet.setBit(19, 1);
      bitSet.setBit(9, 1);
      expect(bitSet.getBit(69)).toBe(1);
      expect(bitSet.getBit(59)).toBe(1);
      expect(bitSet.getBit(49)).toBe(1);
      expect(bitSet.getBit(39)).toBe(1);
      expect(bitSet.getBit(29)).toBe(1);
      expect(bitSet.getBit(19)).toBe(1);
      expect(bitSet.getBit(9)).toBe(1);
      expect(bitSet.getBit(68)).toBe(0);
      expect(bitSet.getBit(58)).toBe(0);
      expect(bitSet.getBit(48)).toBe(0);
      expect(bitSet.getBit(38)).toBe(0);
      expect(bitSet.getBit(28)).toBe(0);
      expect(bitSet.getBit(18)).toBe(0);
      expect(bitSet.getBit(8)).toBe(0);
    });
    it('overwrites bits', () => {
      const bitSet = new BitSet();
      bitSet.setBit(59, 1);
      bitSet.setBit(39, 1);
      bitSet.setBit(19, 1);
      bitSet.setBit(59, 0);
      bitSet.setBit(39, 0);
      bitSet.setBit(19, 0);
      expect(bitSet.getBit(59)).toBe(0);
      expect(bitSet.getBit(39)).toBe(0);
      expect(bitSet.getBit(19)).toBe(0);
    });
  });
  describe('Number operations', () => {
    it('gets zero for empty set', () => {
      const bitSet = new BitSet();
      bitSet.setBit(49, 1);
      expect(bitSet.getBits(49, 49)).toBe(0);
    });
    it('gets bits', () => {
      const bitSet = new BitSet();
      bitSet.setBit(59, 1);
      bitSet.setBit(39, 1);
      bitSet.setBit(19, 1);
      // grab the bits from 18 through 41 (exclusive) - crosses two buffer bits
      expect(bitSet.getBits(18, 41)).toBe(0b01000000000000000000010);
      // grab the bits from 37 through 61 (exclusive) - crosses one buffer bits
      expect(bitSet.getBits(38, 61)).toBe(0b01000000000000000000010);
      // allows requesting bits beyond size, and yields zeros
      expect(bitSet.getBits(38, 70)).toBe(0b01000000000000000000010);
    });
    it('sets bits within a single buffer', () => {
      const bitSet = new BitSet();
      bitSet.setBits(0b11011, 5, 10);
      expect(bitSet.length).toBe(10);
      expect(bitSet.getBits(0, 32)).toBe(0b1101100000);
    });
    it('sets bits across buffer boundary', () => {
      const bitSet = new BitSet();
      bitSet.setBits(0xaaaa, 24, 40);
      expect(bitSet.length).toBe(40);
      expect(bitSet.getBits(0, 32)).toBe(0xaa000000 >> 0);
      expect(bitSet.getBits(32, 64)).toBe(0x000000aa);

      bitSet.length = 0;
      bitSet.setBits(0xdeadbeef, 20);
      expect(bitSet.length).toBe(52);
      expect(bitSet.getBits(0, 32)).toBe(0xeef00000 >> 0);
      expect(bitSet.getBits(32, 64)).toBe(0xdeadb);
    });
  });
  describe('BigNumber operations', () => {
    describe('getBigBits', () => {
      it('gets zero for empty set', () => {
        const bitSet = new BitSet();
        bitSet.setBit(49, 1);
        expect(bitSet.getBigBits(49, 49)).toBe(0n);
        expect(bitSet.getBigBits(49, 50)).toBe(1n);
        expect(bitSet.getBigBits(48, 51)).toBe(0b010n);
      });
      it('gets big bits', () => {
        const bitSet = new BitSet();
        bitSet.setBit(19, 1);
        bitSet.setBit(39, 1);
        bitSet.setBit(59, 1);
        bitSet.setBit(79, 1);
        bitSet.setBit(99, 1);
        // grab the bits from 18 through 41 (exclusive)
        expect(bitSet.getBigBits(18, 41)).toBe(0b01000000000000000000010n);
        // grab the bits from 37 through 61 (exclusive) - crosses one buffer bits
        expect(bitSet.getBigBits(38, 61)).toBe(0b01000000000000000000010n);
        // allows requesting bits beyond size, and yields zeros
        expect(bitSet.getBigBits(38, 70)).toBe(0b01000000000000000000010n);

        // check > 64 bits
        expect(bitSet.getBigBits(18, 85)).toBe(
          0b10000000000000000000100000000000000000001000000000000000000010n,
        );
      });
    });
    describe('setBigBits', () => {
      describe('Single buffer value', () => {
        it('supports small numbers at low bits', () => {
          const bitSet = new BitSet();
          bitSet.setBigBits(0b1010n, 0, 4);
          expect(bitSet.getBits(0, 32)).toBe(0b1010);
          expect(bitSet.length).toBe(4);
        });
        it('supports small numbers', () => {
          const bitSet = new BitSet();
          bitSet.setBigBits(0b1010n, 5, 10);
          expect(bitSet.getBits(0, 32)).toBe(0b101000000);
          expect(bitSet.length).toBe(10);
        });
        it('trims based on end', () => {
          const bitSet = new BitSet();
          bitSet.setBigBits(0b10101n, 5, 9);
          expect(bitSet.getBits(0, 32)).toBe(0b10100000);
          expect(bitSet.length).toBe(9);
        });
        it('uses -1 to fill in 1s', () => {
          const bitSet = new BitSet();
          bitSet.setBigBits(-1n, 1, 31);
          expect(bitSet.getBits(0, 32)).toBe((-1 >>> 1) - 1);
        });
        it('uses 0 to clear 1s', () => {
          const bitSet = new BitSet();
          bitSet.setBigBits(-1n, 1, 31);
          bitSet.setBigBits(0n, 2, 30);
          expect(bitSet.getBits(0, 32)).toBe((1 << 30) | 0b10);
        });
        it('infers end from val', () => {
          const bitSet = new BitSet();
          bitSet.setBigBits(0b11011n, 4);
          expect(bitSet.getBits(0, 32)).toBe(0b110110000);
          expect(bitSet.length).toBe(9);
        });
        it('infers end from length', () => {
          const bitSet = new BitSet();
          bitSet.length = 10;
          bitSet.setBigBits(-1n, 4);
          expect(bitSet.getBits(0, 32)).toBe(0b1111110000);
          expect(bitSet.length).toBe(10);
        });
      });
      describe('Double buffer value', () => {
        it('supports small numbers at low bits', () => {
          const bitSet = new BitSet();
          bitSet.setBigBits(0b1010n, 30, 34);
          expect(bitSet.getBits(0, 32)).toBe(1 << 31);
          expect(bitSet.getBits(32, 64)).toBe(0b10);
          expect(bitSet.length).toBe(34);
        });
        it('trims based on end', () => {
          const bitSet = new BitSet();
          bitSet.setBigBits(0b10101n, 30, 34);
          expect(bitSet.getBits(0, 32)).toBe(1 << 30);
          expect(bitSet.getBits(32, 64)).toBe(1);
          expect(bitSet.length).toBe(34);
        });
        it('uses -1 to fill in 1s', () => {
          const bitSet = new BitSet();
          bitSet.setBigBits(-1n, 1, 63);
          expect(bitSet.getBits(0, 32)).toBe(-2);
          expect(bitSet.getBits(32, 64)).toBe(-1 >>> 1);
          expect(bitSet.length).toBe(63);
        });
        it('uses 0 to clear 1s', () => {
          const bitSet = new BitSet();
          bitSet.setBigBits(-1n, 1, 63);
          bitSet.setBigBits(0n, 2, 62);
          expect(bitSet.getBits(0, 32)).toBe(2);
          expect(bitSet.getBits(32, 64)).toBe((-1 >>> 2) + 1);
          expect(bitSet.length).toBe(63);
        });
        it('infers end from val', () => {
          const bitSet = new BitSet();
          bitSet.setBigBits(0xa234567890n, 12);
          expect(bitSet.getBits(0, 32)).toBe(0x67890000);
          expect(bitSet.getBits(32, 64)).toBe(0xa2345);
          expect(bitSet.length).toBe(52);
        });
        it('infers end from length', () => {
          const bitSet = new BitSet();
          bitSet.length = 55;
          bitSet.setBigBits(-1n, 4);
          expect(bitSet.getBits(0, 32)).toBe(-1 << 4);
          expect(bitSet.getBits(32, 64)).toBe(-1 >>> -55);
          expect(bitSet.length).toBe(55);
        });
      });
      describe('Multiple buffer value', () => {
        it('supports small numbers at low bits', () => {
          const bitSet = new BitSet();
          bitSet.setBigBits(0x1234567890abcdef1234n, 28, 108);
          expect(bitSet.getBits(0, 32)).toBe(0x4 << 28);
          expect(bitSet.getBits(32, 64)).toBe(0xbcdef123 >> 0);
          expect(bitSet.getBits(64, 96)).toBe(0x4567890a);
          expect(bitSet.getBits(96, 128)).toBe(0x123);
          expect(bitSet.length).toBe(108);
        });
        it('trims based on end', () => {
          const bitSet = new BitSet();
          bitSet.setBigBits(0x1234567890abcdef1234n, 28, 92);
          expect(bitSet.getBits(0, 32)).toBe(0x4 << 28);
          expect(bitSet.getBits(32, 64)).toBe(0xbcdef123 >> 0);
          expect(bitSet.getBits(64, 96)).toBe(0x567890a);
          expect(bitSet.length).toBe(92);
        });
        it('uses -1 to fill in 1s', () => {
          const bitSet = new BitSet();
          bitSet.setBigBits(-1n, 1, 127);
          expect(bitSet.getBits(0, 32)).toBe(-2);
          expect(bitSet.getBits(32, 64)).toBe(-1);
          expect(bitSet.getBits(64, 96)).toBe(-1);
          expect(bitSet.getBits(96, 128)).toBe(-1 >>> 1);
          expect(bitSet.length).toBe(127);
        });
        it('uses 0 to clear 1s', () => {
          const bitSet = new BitSet();
          bitSet.setBigBits(-1n, 1, 127);
          bitSet.setBigBits(0n, 2, 126);
          expect(bitSet.getBits(0, 32)).toBe(2);
          expect(bitSet.getBits(32, 64)).toBe(0);
          expect(bitSet.getBits(64, 96)).toBe(0);
          expect(bitSet.getBits(96, 128)).toBe((-1 >>> 2) + 1);
          expect(bitSet.length).toBe(127);
        });
        it('infers end from val', () => {
          const bitSet = new BitSet();
          bitSet.setBigBits(0xa234567890abcdef1234n, 28);
          expect(bitSet.getBits(0, 32)).toBe(0x4 << 28);
          expect(bitSet.getBits(32, 64)).toBe(0xbcdef123 >> 0);
          expect(bitSet.getBits(64, 96)).toBe(0x4567890a);
          expect(bitSet.getBits(96, 128)).toBe(0xa23);
          expect(bitSet.length).toBe(108);
        });
        it('infers end from length', () => {
          const bitSet = new BitSet();
          bitSet.length = 120;
          // initialize with all ones
          bitSet.setBigBits(-1n, 0);
          expect(bitSet.getBits(0, 32)).toBe(-1);
          expect(bitSet.getBits(32, 64)).toBe(-1);
          expect(bitSet.getBits(64, 96)).toBe(-1);
          expect(bitSet.getBits(96, 128)).toBe(-1 >>> 8);
          expect(bitSet.length).toBe(120);
          // now, overwrite most of them
          bitSet.setBigBits(0xa234567890abcdef1234n, 28);
          expect(bitSet.getBits(0, 32)).toBe(0x4fffffff);
          expect(bitSet.getBits(32, 64)).toBe(0xbcdef123 >> 0);
          expect(bitSet.getBits(64, 96)).toBe(0x4567890a);
          // note: leading ones cleared to zero
          expect(bitSet.getBits(96, 128)).toBe(0xa23);
          expect(bitSet.length).toBe(120);
        });
      });
      it('handles random round trips', () => {
        const samples = 100;
        const subSamples = 10;
        for (let i = 0; i < samples; i++) {
          const bitSet = new BitSet();
          const tests = [];
          for (let j = 0; j < subSamples; j++) {
            const start = testRandom.getRandomInteger(64);
            const end = start + testRandom.getRandomInteger(64);
            const bitsToUse = testRandom.getRandomInteger(
              end - start + 10,
              Math.max(end - start - 10, 0),
            );
            let val = testRandom.getRandomBigBits(BigInt(bitsToUse));
            if (testRandom.getRandomBits(1) !== 0) {
              val = ~val;
            }
            tests.push({ val, start, end });
            bitSet.setBigBits(val, start, end);
            const result = bitSet.getBigBits(start, end);
            const comp = val & ((1n << BigInt(end - start)) - 1n);
            if (result !== comp) {
              console.log(
                'Error logs:\n%o\n\nactual: %s\ncalced: %s',
                tests,
                result.toString(16),
                comp.toString(16),
              );
              throw new Error('Found round trip failure. See logs');
            }
          }
        }
      });
      // fit('single test', () => {
      //   const bitSet = new BitSet();
      //   const tests = [
      //     { val: -173n, start: 15, end: 18 },
      //     { val: -77373n, start: 7, end: 34 },
      //     { val: -269344519n, start: 32, end: 64 },
      //   ];
      //   for (const test of tests) {
      //     const { val, start, end } = test;
      //     bitSet.setBigBits(val, start, end);
      //     const result = bitSet.getBigBits(start, end);
      //     const comp = val & ((1n << BigInt(end - start)) - 1n);
      //     if (result !== comp) {
      //       console.log(
      //         'Error logs:\n%o\n\nactual: %s\ncalced: %s',
      //         tests,
      //         result.toString(16),
      //         comp.toString(16)
      //       );
      //       throw new Error('Found round trip failure. See logs');
      //     }
      //   }
      // });
    });
  });
  describe('trim', () => {
    it('trims trailing zeros', () => {
      const bitSet = new BitSet();
      // set it to 70 1s
      bitSet.length = 70;
      bitSet.setBigBits(-1n, 0);
      expect(bitSet.toBigInt()).toBe((1n << 70n) - 1n);

      // update it to 10 1s and 60 0s
      bitSet.setBigBits(0n, 10);
      expect(bitSet.toBigInt()).toBe((1n << 10n) - 1n);
      expect(bitSet.length).toBe(70);

      // trim trailing zeros so its still 10 1s, but 0 0s
      bitSet.trim();
      expect(bitSet.toBigInt()).toBe((1n << 10n) - 1n);
      expect(bitSet.length).toBe(10);
    });
    it('trims to 32-bits', () => {
      const expected = new BitSet();
      expected.setBits(0xcafebabe, 0);

      let bitset = expected.clone();
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 33;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 40;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 48;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 63;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 64;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 65;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 80;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 95;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 96;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 97;
      expect(bitset.trim()).toEqual(expected);
    });
    it('trims to 0', () => {
      const expected = new BitSet();

      let bitset = expected.clone();
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 1;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 16;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 31;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 32;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 33;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 48;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 63;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 64;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 65;
      expect(bitset.trim()).toEqual(expected);
    });
    it('trims to arbitrary', () => {
      // length: 37
      const expected = new BitSetWriter().writeBigBits(0x10cafebaben).bitset;

      let bitset = expected.clone();
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 37;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 48;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 63;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 64;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 65;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 95;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 96;
      expect(bitset.trim()).toEqual(expected);

      bitset = expected.clone();
      bitset.length = 97;
      expect(bitset.trim()).toEqual(expected);
    });
  });
  describe('countBits', () => {
    it('countsBits', () => {
      expect(new BitSet().countBits()).toBe(0);
      expect(new BitSet(1).countBits()).toBe(1);
      expect(
        new BitSet([0, 0xffffffff, 0b1001011010001, 0xcafebabe]).countBits(),
      ).toBe(60);
    });
  });
});

describe('BitSet Reader / Writer', () => {
  describe('Single Bit Operations', () => {
    it('updates length when setting bits', () => {
      const bitset = new BitSet();
      const writer = bitset.toWriter();
      writer.write(1);
      writer.write(0);
      expect(bitset.length).toBe(2);
      bitset.toWriter(10).write(0);
      expect(bitset.length).toBe(11);
    });
    it('returns bits set', () => {
      const bitset = new BitSet();
      const reader = bitset.toReader();
      const writer = bitset.toWriter();
      expect(() => reader.read()).toThrow();
      expect(bitset.toReader(0, 1).read()).toBe(0);
      bitset.length = 1;
      expect(reader.read()).toBe(0);
      writer.write(1);
      expect(bitset.toReader().read()).toBe(1);
      bitset.toWriter(0).write(0);
      expect(bitset.toReader().read()).toBe(0);

      expect(bitset.toReader(100, 101).read()).toBe(0);
      bitset.toWriter(100).write();
      expect(bitset.toReader(100).read()).toBe(1);
      bitset.toWriter(100).write(0);
      expect(bitset.toReader(100).read()).toBe(0);
    });
    it('cant access bits with restricted length', () => {
      const bitset = new BitSet();
      let reader = bitset.toReader(25);

      bitset.setBit(24, 1);
      bitset.setBit(25, 1);
      bitset.setBit(26, 1);
      bitset.setBit(74, 1);
      bitset.setBit(75, 1);
      bitset.setBit(76, 1);

      // 25 and 26 in range
      expect(reader.read()).toBe(1);
      expect(reader.read()).toBe(1);
      expect(reader.read()).toBe(0);

      reader = bitset.toReader(74, 75);
      expect(reader.isClosed()).toBeFalse();
      expect(reader.count()).toBe(1);
      expect(reader.read()).toBe(1);
      expect(reader.isClosed()).toBeTrue();
      expect(() => reader.read()).toThrow();
      expect(reader.count()).toBe(0);
    });
    it('sets and gets single bits', () => {
      const bitset = new BitSet();
      bitset.toWriter(69).write();
      bitset.toWriter(59).write();
      bitset.toWriter(49).write();
      bitset.toWriter(39).write();
      bitset.toWriter(29).write();
      bitset.toWriter(19).write();
      bitset.toWriter(9).write();
      let reader = bitset.toReader(8);
      expect(reader.read()).toBe(0);
      expect(reader.read()).toBe(1);
      expect(reader.read()).toBe(0);
      reader = bitset.toReader(18);
      expect(reader.read()).toBe(0);
      expect(reader.read()).toBe(1);
      expect(reader.read()).toBe(0);
      reader = bitset.toReader(28);
      expect(reader.read()).toBe(0);
      expect(reader.read()).toBe(1);
      expect(reader.read()).toBe(0);
      reader = bitset.toReader(38);
      expect(reader.read()).toBe(0);
      expect(reader.read()).toBe(1);
      expect(reader.read()).toBe(0);
      reader = bitset.toReader(48);
      expect(reader.read()).toBe(0);
      expect(reader.read()).toBe(1);
      expect(reader.read()).toBe(0);
      reader = bitset.toReader(58);
      expect(reader.read()).toBe(0);
      expect(reader.read()).toBe(1);
      expect(reader.read()).toBe(0);
      reader = bitset.toReader(68, 71);
      expect(reader.read()).toBe(0);
      expect(reader.read()).toBe(1);
      expect(reader.read()).toBe(0);
    });
    it('overwrites bits', () => {
      const bitset = new BitSet();
      bitset.toWriter(59).write();
      bitset.toWriter(39).write();
      bitset.toWriter(19).write();
      bitset.toWriter(59).write(0);
      bitset.toWriter(39).write(0);
      bitset.toWriter(19).write(0);
      expect(bitset.toReader(59).read()).toBe(0);
      expect(bitset.toReader(39).read()).toBe(0);
      expect(bitset.toReader(19).read()).toBe(0);
    });
  });
  describe('Number operations', () => {
    it('throws for empty iterator', () => {
      const bitset = new BitSet();
      bitset.setBit(49, 1);
      expect(() => bitset.toReader(49, 49).readBatch(1)).toThrow();
      expect(bitset.toReader(49, 49 + 32).readBatch()).toBe(1);
    });
    it('gets zero for empty read', () => {
      const bitset = new BitSet();
      bitset.setBit(49, 1);
      const reader = bitset.toReader(49);
      expect(reader.readBatch(0)).toBe(0);
      expect(reader.count()).toBe(1);
    });
    it('gets bits', () => {
      const bitset = new BitSet();
      bitset.setBit(59, 1);
      bitset.setBit(39, 1);
      bitset.setBit(19, 1);
      bitset.length++;
      // grab the bits from 18 through 41 (exclusive) - crosses two buffer bits
      let reader = bitset.toReader(18);
      expect(reader.readBatch(23)).toBe(0b01000000000000000000010);
      // grab the bits from 37 through 61 (exclusive) - crosses one buffer bits
      reader = bitset.toReader(38);
      expect(reader.readBatch(23)).toBe(0b01000000000000000000010);
      // allows requesting bits beyond size, and yields zeros
      reader = bitset.toReader(38, 38 + 32);
      expect(reader.readBatch(32)).toBe(0b01000000000000000000010);
    });
    it('sets bits within a single buffer', () => {
      const bitset = new BitSet();
      bitset.toWriter(5).writeBatch(0b11011, 5);
      expect(bitset.length).toBe(10);
      expect(bitset.toReader().readBatch(10)).toBe(0b1101100000);
    });
    it('sets bits across buffer boundary', () => {
      const bitset = new BitSet();
      bitset.toWriter(24).writeBatch(0xaaaa, 16);
      expect(bitset.length).toBe(40);
      let reader = bitset.toReader(0, 64);
      expect(reader.readBatch()).toBe(0xaa000000 >> 0);
      expect(reader.readBatch()).toBe(0x000000aa);

      bitset.length = 0;
      bitset.toWriter(20).writeBatch(0xdeadbeef);
      expect(bitset.length).toBe(52);
      reader = bitset.toReader(0, 64);
      expect(reader.readBatch()).toBe(0xeef00000 >> 0);
      expect(reader.readBatch()).toBe(0xdeadb);
    });
  });
  describe('BigNumber operations', () => {
    describe('getBigBits', () => {
      it('gets zero for empty set', () => {
        const bitset = new BitSet();
        bitset.setBit(49);
        const reader = bitset.toReader(49);
        expect(reader.readBigBits(0)).toBe(0n);
        expect(reader.readBigBits(1)).toBe(1n);
        expect(() => bitset.toReader(49).readBigBits(3)).toThrow();
        // expect(bitset.toReader(48, 51).readBigBits(3)).toBe(0b010n);
      });
      it('gets big bits', () => {
        const bitset = new BitSet();
        bitset.setBit(19, 1);
        bitset.setBit(39, 1);
        bitset.setBit(59, 1);
        bitset.setBit(79, 1);
        bitset.setBit(99, 1);

        // grab the bits from 18 through 41 (exclusive)
        expect(bitset.toReader(18).readBigBits(23)).toBe(
          0b01000000000000000000010n,
        );
        // grab the bits from 37 through 61 (exclusive) - crosses one buffer bits
        expect(bitset.toReader(38).readBigBits(23)).toBe(
          0b01000000000000000000010n,
        );
        // allows requesting bits beyond size, and yields zeros
        expect(bitset.toReader(38).readBigBits(32)).toBe(
          0b01000000000000000000010n,
        );

        // check > 64 bits
        expect(bitset.toReader(18).readBigBits(67)).toBe(
          0b10000000000000000000100000000000000000001000000000000000000010n,
        );
      });
    });
  });
});
describe('BitSourceReader', () => {
  it('Reads single bits', () => {
    const reader = new BitSourceReader([
      { value: 0b1001, bitCount: 4 },
      { value: 0b0110, bitCount: 4 },
    ]);
    expect(reader.read()).toBe(1);
    expect(reader.read()).toBe(0);
    expect(reader.read()).toBe(0);
    expect(reader.read()).toBe(1);
    expect(reader.read()).toBe(0);
    expect(reader.read()).toBe(1);
    expect(reader.read()).toBe(1);
    expect(reader.read()).toBe(0);
    expect(() => reader.read()).toThrow();
  });
  it('reports done after single bits', () => {
    const reader = new BitSourceReader([
      { value: 0b1, bitCount: 1 },
      { value: 0b0, bitCount: 1 },
    ]);
    expect(reader.isClosed()).toBe(false);
    reader.read();
    expect(reader.isClosed()).toBe(false);
    reader.read();
    expect(reader.isClosed()).toBe(true);
  });
  it('reads multiple bits', () => {
    const reader = new BitSourceReader([
      { value: 0xcafe, bitCount: 16 },
      { value: 0xbabe, bitCount: 16 },
    ]);
    expect(reader.readBatch(12)).toBe(0xafe);
    expect(reader.readBatch(12)).toBe(0xbec);
    expect(reader.readBatch(8)).toBe(0xba);
  });
  it('reads multiple bits across int boundaries', () => {
    const reader = new BitSourceReader([
      { value: 0xcafe, bitCount: 16 },
      { value: 0xbabe, bitCount: 16 },
      { value: 0xdeadbeef, bitCount: 32 },
    ]);
    expect(reader.readBatch(16)).toBe(0xcafe);
    expect(reader.readBatch(32)).toBe(0xbeefbabe | 0);
    expect(reader.readBatch(16)).toBe(0xdead);
  });
  it('marks done after multiple bits', () => {
    const reader = new BitSourceReader([
      { value: 0xcafe, bitCount: 16 },
      { value: 0xbabe, bitCount: 16 },
      { value: 0xdeadbeef, bitCount: 32 },
    ]);
    expect(reader.isClosed()).toBeFalse();
    reader.readBatch(16);
    expect(reader.isClosed()).toBeFalse();
    reader.readBatch(16);
    expect(reader.isClosed()).toBeFalse();
    reader.readBatch(5);
    expect(reader.isClosed()).toBeFalse();
    reader.readBatch(27);
    expect(reader.isClosed()).toBeTrue();
  });
  it('marks done after close', () => {
    const reader = new BitSourceReader([{ value: 0xcafebabe, bitCount: 32 }]);
    expect(reader.isClosed()).toBeFalse();
    reader.readBatch(16);
    expect(reader.isClosed()).toBeFalse();
    reader.close();
    expect(reader.isClosed()).toBeTrue();
  });
  it('reports negative bitsremaining with arrays', () => {
    const reader = new BitSourceReader([{ value: 0xcafebabe, bitCount: 32 }]);
    expect(reader.count()).toBe(32);
    reader.readBatch();
    // now that the stream is exhausted, there are known to be zero bits left
    expect(reader.count()).toBe(0);
  });
  it('reports negative one bitsremaining when not initialized', () => {
    const reader = new BitSourceReader(
      [{ value: 0xcafebabe, bitCount: 32 }][Symbol.iterator](),
    );
    expect(reader.count()).toBe(-1);
    reader.readBatch();
    // now that the stream is exhausted, there are known to be zero bits left
    expect(reader.count()).toBe(0);
  });
  it('reports correct bits remaining when initialized', () => {
    const reader = new BitSourceReader(
      [
        { value: 0xcafe, bitCount: 16 },
        { value: 0xbabe, bitCount: 16 },
        { value: 0xdeadbeef, bitCount: 32 },
      ],
      64,
    );
    expect(reader.count()).toBe(64);
    reader.readBatch();
    expect(reader.count()).toBe(32);
    reader.read();
    expect(reader.count()).toBe(31);
    reader.readBatch(13);
    expect(reader.count()).toBe(18);
    reader.readBatch(18);
    expect(reader.count()).toBe(0);
  });
  it('returns bigint', () => {
    const reader = new BitSourceReader([
      { value: 0xcafe, bitCount: 16 },
      { value: 0xbabe, bitCount: 16 },
    ]);
    expect(reader.readBigBits(12)).toBe(0xafen);
    expect(reader.readBigBits(12)).toBe(0xbecn);
    expect(reader.readBigBits(8)).toBe(0xban);
  });
  it('returns remaining bigint', () => {
    const reader = new BitSourceReader([
      { value: 0xcafe, bitCount: 16 },
      { value: 0xbabe, bitCount: 16 },
    ]);
    expect(reader.readBigBits(12)).toBe(0xafen);
    expect(reader.readBigBits()).toBe(0xbabecn);
  });
  it('returns bigint larger than 64 bits', () => {
    const reader = new BitSourceReader([
      { value: 0xcafebabe, bitCount: 32 },
      { value: 0xdeadbeef, bitCount: 32 },
      { value: 0xbad, bitCount: 12 },
    ]);
    expect(reader.readBatch(4)).toBe(0xe);
    expect(reader.readBigBits(72)).toBe(0xbaddeadbeefcafebabn);
  });
  it('returns bigint larger than 64 bits', () => {
    const reader = new BitSourceReader([
      { value: 0xcafebabe, bitCount: 32 },
      { value: 0xdeadbeef, bitCount: 32 },
      { value: 0xbad, bitCount: 12 },
    ]);
    expect(reader.readBatch(4)).toBe(0xe);
    expect(reader.readBigBits(72)).toBe(0xbaddeadbeefcafebabn);
    expect(reader.isClosed()).toBeTrue();
  });
  it('returns remaining bigint larger than 64 bits', () => {
    const reader = new BitSourceReader([
      { value: 0xcafebabe, bitCount: 32 },
      { value: 0xdeadbeef, bitCount: 32 },
      { value: 0xbad, bitCount: 12 },
    ]);
    expect(reader.readBatch(4)).toBe(0xe);
    expect(reader.readBigBits()).toBe(0xbaddeadbeefcafebabn);
    expect(reader.isClosed()).toBeTrue();
  });
  it('masks values that are over-specified', () => {
    const reader = BitSourceReader.create([0b1111011, 0b11000010], 6);
    expect(reader.readBatch(6)).toBe(0b111011);
    expect(reader.readBatch(6)).toBe(0b10);
  });
});
describe('concatenateReaders', () => {
  function getReader(val: bigint, bitCount?: number): BitReader {
    return new BitSetWriter().writeBigBits(val, bitCount).bitset.toReader();
  }
  it('concatenates empty readers', () => {
    expect(
      concatenateReaders([
        getReader(0n, 0),
        getReader(0n, 0),
        getReader(0n, 0),
      ]).isClosed(),
    ).toBeTrue();
  });
  it('reads single bits', () => {
    const reader = concatenateReaders([
      getReader(0b1010n),
      getReader(0b1100n),
      getReader(0b1001n),
    ]);
    expect(reader.read()).toBe(0);
    expect(reader.read()).toBe(1);
    expect(reader.read()).toBe(0);
    expect(reader.read()).toBe(1);
    expect(reader.read()).toBe(0);
    expect(reader.read()).toBe(0);
    expect(reader.read()).toBe(1);
    expect(reader.read()).toBe(1);
    expect(reader.read()).toBe(1);
    expect(reader.read()).toBe(0);
    expect(reader.read()).toBe(0);
    expect(reader.read()).toBe(1);
  });
  it('reads multiple bits', () => {
    const reader = concatenateReaders([
      getReader(0b1010n),
      getReader(0b1100n),
      getReader(0b1001n),
    ]);
    expect(reader.readBatch(3)).toBe(0b010);
    expect(reader.readBatch(3)).toBe(0b001);
    expect(reader.readBatch(3)).toBe(0b111);
    expect(reader.readBatch(3)).toBe(0b100);
  });
  it('reads multiple bigbits', () => {
    const reader = concatenateReaders([
      getReader(0xdeadbeefn),
      getReader(0xcafebaben),
      getReader(0xbadbadn),
    ]);
    expect(reader.asBigBitReader().readBatch(8)).toBe(0xefn);
    expect(reader.asBigBitReader().readBatch(76)).toBe(0xadbadcafebabedeadben);
    expect(reader.asBigBitReader().readBatch(4)).toBe(0xbn);
  });
  it('reads remaining bigbits', () => {
    const reader = concatenateReaders([
      getReader(0xdeadbeefn),
      getReader(0xcafebaben),
      getReader(0xbadbadn),
    ]);
    expect(reader.asBigBitReader().readBatch(8)).toBe(0xefn);
    expect(reader.asBigBitReader().readBatch()).toBe(0xbadbadcafebabedeadben);
  });
  it('returns bitsremaining', () => {
    const reader = concatenateReaders([
      getReader(0xdeadbeefn),
      getReader(0xcafebaben),
      getReader(0xbadbadn),
    ]);
    expect(reader.count()).toBe(88);
    reader.asBigBitReader().readBatch(88);
    expect(reader.count()).toBe(0);
    expect(reader.isClosed()).toBeTrue();
    expect(reader.pending()).toBe(0);
  });
});
describe('interator', () => {
  it('splits into fixed size chunks', () => {
    expect([...interator(bitset(0xcafebabe).toReader(), 12)]).toEqual([
      0xabe, 0xfeb, 0xca,
    ]);
  });
});
describe('biterator', () => {
  it('yields bits', () => {
    expect([...biterator(bitset(0b1011001, 7).toReader())]).toEqual([
      1, 0, 0, 1, 1, 0, 1,
    ]);
  });
});
