import {BitSet, BitReader} from './io.js';
import {testRandom} from './random.js';
import {
  BitExtendedCoder,
  DeltaCoder,
  InterleaveCoder,
  VariableLengthQuantityCoder,
  encodeGrid,
  encodeToBitset,
} from './storage.js';
import {bitset} from './test_utils.js';

describe('Storage', () => {
  describe('Variable Length Coder', () => {
    function encodeContinuous(
      val: number | bigint,
      infoBitCount: number,
    ): BitSet {
      return typeof val === 'number'
        ? encodeToBitset(val, new VariableLengthQuantityCoder(infoBitCount))
        : encodeToBitset(
            val,
            new VariableLengthQuantityCoder(infoBitCount).bigintCoder(),
          );
    }

    function decodeContinuous(input: BitReader, infoBitCount: number): number {
      return new VariableLengthQuantityCoder(infoBitCount).decode(input);
    }

    function decodeBigContinuous(input: BitReader, bitCount: number): bigint {
      return new VariableLengthQuantityCoder(bitCount).decodeBigInt(input);
    }
    describe('encode', () => {
      it('encodes zero', () => {
        expect(encodeContinuous(0, 1)).toEqual(bitset(0, 2));
        expect(encodeContinuous(0, 2)).toEqual(bitset(0, 3));
        expect(encodeContinuous(0, 5)).toEqual(bitset(0, 6));
      });
      it('encodes single values without change', () => {
        expect(encodeContinuous(1, 1)).toEqual(bitset(1, 2));
        expect(encodeContinuous(3, 2)).toEqual(bitset(3, 3));
        expect(encodeContinuous(15, 5)).toEqual(bitset(15, 6));
        expect(encodeContinuous(31, 5)).toEqual(bitset(31, 6));
      });
      it('encodes double values', () => {
        expect(encodeContinuous(3, 1)).toEqual(bitset(0b0111, 4));
        expect(encodeContinuous(5, 2)).toEqual(bitset(0b001101, 6));
        expect(encodeContinuous(7, 2)).toEqual(bitset(0b001111, 6));
        expect(encodeContinuous(53, 3)).toEqual(bitset(0b01101101, 8));
        expect(encodeContinuous(42, 5)).toEqual(bitset(0b000001101010, 12));
        expect(encodeContinuous(63, 5)).toEqual(bitset(0b000001111111, 12));
        expect(encodeContinuous(798, 5)).toEqual(bitset(0b011000111110, 12));
      });
      it('encodes a few large values', () => {
        // I didn't actually test this manually... it's here in case something
        // changes
        expect(encodeContinuous(0x34e5c427f7b4734d9800n, 5)).toEqual(
          bitset(0x1b3cbca29ff7db1e74ee6820n, 96),
        );
      });
    });
    describe('decode', () => {
      it('decodes values under 32 with single character', () => {
        expect(decodeContinuous(bitset(0, 6).toReader(), 5)).toBe(0);
        expect(decodeContinuous(bitset(25, 6).toReader(), 5)).toBe(25);
        expect(decodeContinuous(bitset(26, 6).toReader(), 5)).toBe(26);
        expect(decodeContinuous(bitset(31, 6).toReader(), 5)).toBe(31);
      });
      it('decodes values under 1024 with 2 characters', () => {
        expect(decodeContinuous(bitset(0b000001100000, 12).toReader(), 5)).toBe(
          32,
        );
        expect(decodeContinuous(bitset(0b010110111101, 12).toReader(), 5)).toBe(
          733,
        );
        expect(decodeContinuous(bitset(0b011111111111, 12).toReader(), 5)).toBe(
          1023,
        );
      });
      it('decodes a few large values', () => {
        // I didn't actually test these manually... they are here in case
        // something changes
        expect(
          decodeBigContinuous(
            bitset(0xe9b1f61a77c25bbbda9ef4dab934n, 114).toReader(),
            5,
          ),
        ).toBe(0x38d1e8537815dbb2774b2c94n);
        expect(
          decodeBigContinuous(
            bitset(0x1b3cbca29ff7db1e74ee6820n, 96).toReader(),
            5,
          ),
        ).toBe(0x34e5c427f7b4734d9800n);
      });
    });
    it('encodes / decodes round trip', () => {
      const samples = 100;
      for (let i = 0; i < samples; i++) {
        const val = testRandom.getRandomBits(32) >> 0;
        const bitCount = testRandom.getRandomInteger(32, 1);
        let encoded: BitSet | undefined = undefined;
        let decoded: number | undefined = undefined;
        try {
          encoded = encodeContinuous(val, bitCount);
          decoded = decodeContinuous(encoded.toReader(), bitCount);
          throwUnless(decoded).toBe(val);
        } catch (e) {
          console.log('Round trip failed. data: %o', {
            bitCount,
            val: '0x' + val.toString(16),
            decoded: decoded?.toString(16),
          });
          throw e;
        }
      }
    });
    // fit('test single sample', () => {
    //   const val = -0x4de8d76c;
    //   const bitCount = 9;
    //   let encoded: Reader | undefined = undefined;
    //   let decoded: number | undefined = undefined;
    //   try {
    //     encoded = encodeContinuous(val, bitCount);
    //     decoded = decodeContinuous(encoded, bitCount);
    //     throwUnless(decoded).toBe(val);
    //   } catch (e) {
    //     console.log('Round trip failed. data: %o', {
    //       bitCount,
    //       val: val.toString(2),
    //       decoded: decoded?.toString(2),
    //     });
    //     throw e;
    //   }
    // });
    it('encodes / decodes bigint round trip', () => {
      const samples = 100;
      for (let i = 0; i < samples; i++) {
        const val = testRandom.getRandomBigBits(1000);
        const bitCount = testRandom.getRandomInteger(32, 1);
        const encoded = encodeContinuous(val, bitCount);
        const decoded = decodeBigContinuous(encoded.toReader(), bitCount);
        if (decoded !== val) {
          console.log(
            'Round trip failed.\nBitcount: %d\nVal: 0x%s\ndecoded: 0x%s',
            bitCount,
            val.toString(16),
            decoded.toString(16),
          );
          console.log('Encoded: %o', encoded);
          throw new Error(
            'Round trip failed for continuous integer encoding. See logs',
          );
        }
      }
    });
  });
  describe('Bit Extended', () => {
    function encodeBitExtended(
      val: number | bigint,
      infoBitCount: number,
    ): BitSet {
      return typeof val === 'number'
        ? encodeToBitset(val, new BitExtendedCoder(infoBitCount))
        : encodeToBitset(val, new BitExtendedCoder(infoBitCount).bigintCoder());
    }
    function decodeBitExtended(input: BitReader, infoBitCount: number): number {
      return new BitExtendedCoder(infoBitCount).decode(input);
    }
    function decodeBigBitExtended(
      input: BitReader,
      infoBitCount: number,
    ): bigint {
      return new BitExtendedCoder(infoBitCount).decodeBigInt(input);
    }

    describe('encodes', () => {
      it('encodes with bitcount 0', () => {
        expect(() => encodeBitExtended(0, 0)).toThrow();
        expect(encodeBitExtended(1, 0)).toEqual(bitset(0, 1));
        expect(encodeBitExtended(2, 0)).toEqual(bitset(0b001, 3));
        expect(encodeBitExtended(3, 0)).toEqual(bitset(0b011, 3));
        expect(encodeBitExtended(4, 0)).toEqual(bitset(0b00101, 5));
        expect(encodeBitExtended(5, 0)).toEqual(bitset(0b00111, 5));
      });
      it('encodes with bitcount 1', () => {
        expect(encodeBitExtended(0, 1)).toEqual(bitset(0, 2));
        expect(encodeBitExtended(1, 1)).toEqual(bitset(1, 2));
        expect(encodeBitExtended(2, 1)).toEqual(bitset(0b010, 3));
        expect(encodeBitExtended(3, 1)).toEqual(bitset(0b011, 3));
        expect(encodeBitExtended(4, 1)).toEqual(bitset(0b00110, 5));
        expect(encodeBitExtended(5, 1)).toEqual(bitset(0b00111, 5));
      });
      it('encodes with bitcount 3', () => {
        expect(encodeBitExtended(0, 3)).toEqual(bitset(0b0000, 4));
        expect(encodeBitExtended(1, 3)).toEqual(bitset(0b0001, 4));
        expect(encodeBitExtended(7, 3)).toEqual(bitset(0b0111, 4));
        expect(encodeBitExtended(8, 3)).toEqual(bitset(0b01000, 5));
        expect(encodeBitExtended(9, 3)).toEqual(bitset(0b01001, 5));
        expect(encodeBitExtended(10, 3)).toEqual(bitset(0b01010, 5));
        expect(encodeBitExtended(15, 3)).toEqual(bitset(0b01111, 5));
        expect(encodeBitExtended(16, 3)).toEqual(bitset(0b0011000, 7));
        expect(encodeBitExtended(23, 3)).toEqual(bitset(0b0011111, 7));
        expect(encodeBitExtended(24, 3)).toEqual(bitset(0b0111000, 7));
      });
      it('encodes bigints with bitcount 3', () => {
        expect(encodeBitExtended(0n, 3)).toEqual(bitset(0b0000, 4));
        expect(encodeBitExtended(1n, 3)).toEqual(bitset(0b0001, 4));
        expect(encodeBitExtended(7n, 3)).toEqual(bitset(0b0111, 4));
        expect(encodeBitExtended(8n, 3)).toEqual(bitset(0b01000, 5));
        expect(encodeBitExtended(9n, 3)).toEqual(bitset(0b01001, 5));
        expect(encodeBitExtended(10n, 3)).toEqual(bitset(0b01010, 5));
        expect(encodeBitExtended(15n, 3)).toEqual(bitset(0b01111, 5));
        expect(encodeBitExtended(16n, 3)).toEqual(bitset(0b0011000, 7));
        expect(encodeBitExtended(23n, 3)).toEqual(bitset(0b0011111, 7));
        expect(encodeBitExtended(24n, 3)).toEqual(bitset(0b0111000, 7));
      });
      it('encodes large values', () => {
        expect(encodeBitExtended(0b1001011010100101101011101010, 2)).toEqual(
          bitset(0b001011101111101110111010111011111011101111111011101110n, 54),
        );
      });
    });
    describe('decodes', () => {
      it('decodes with bitcount 0', () => {
        expect(decodeBitExtended(bitset(0, 1).toReader(), 0)).toEqual(1);
        expect(decodeBitExtended(bitset(0b001, 3).toReader(), 0)).toEqual(2);
        expect(decodeBitExtended(bitset(0b011, 3).toReader(), 0)).toEqual(3);
        expect(decodeBitExtended(bitset(0b00101, 5).toReader(), 0)).toEqual(4);
        expect(decodeBitExtended(bitset(0b00111, 5).toReader(), 0)).toEqual(5);
      });
      it('decodes with bitcount 1', () => {
        expect(decodeBitExtended(bitset(0, 2).toReader(), 1)).toEqual(0);
        expect(decodeBitExtended(bitset(1, 2).toReader(), 1)).toEqual(1);
        expect(decodeBitExtended(bitset(0b010, 3).toReader(), 1)).toEqual(2);
        expect(decodeBitExtended(bitset(0b011, 3).toReader(), 1)).toEqual(3);
        expect(decodeBitExtended(bitset(0b00110, 5).toReader(), 1)).toEqual(4);
        expect(decodeBitExtended(bitset(0b00111, 5).toReader(), 1)).toEqual(5);
      });
      it('decodes with bitcount 3', () => {
        expect(decodeBitExtended(bitset(0b0000, 4).toReader(), 3)).toEqual(0);
        expect(decodeBitExtended(bitset(0b0001, 4).toReader(), 3)).toEqual(1);
        expect(decodeBitExtended(bitset(0b0111, 4).toReader(), 3)).toEqual(7);
        expect(decodeBitExtended(bitset(0b01000, 5).toReader(), 3)).toEqual(8);
        expect(decodeBitExtended(bitset(0b01001, 5).toReader(), 3)).toEqual(9);
        expect(decodeBitExtended(bitset(0b01010, 5).toReader(), 3)).toEqual(10);
        expect(decodeBitExtended(bitset(0b01111, 5).toReader(), 3)).toEqual(15);
        expect(decodeBitExtended(bitset(0b0011000, 7).toReader(), 3)).toEqual(
          16,
        );
        expect(decodeBitExtended(bitset(0b0011111, 7).toReader(), 3)).toEqual(
          23,
        );
        expect(decodeBitExtended(bitset(0b0111000, 7).toReader(), 3)).toEqual(
          24,
        );
      });
      it('decodes bigint with bitcount 3', () => {
        expect(decodeBigBitExtended(bitset(0b0000, 4).toReader(), 3)).toEqual(
          0n,
        );
        expect(decodeBigBitExtended(bitset(0b0001, 4).toReader(), 3)).toEqual(
          1n,
        );
        expect(decodeBigBitExtended(bitset(0b0111, 4).toReader(), 3)).toEqual(
          7n,
        );
        expect(decodeBigBitExtended(bitset(0b01000, 5).toReader(), 3)).toEqual(
          8n,
        );
        expect(decodeBigBitExtended(bitset(0b01001, 5).toReader(), 3)).toEqual(
          9n,
        );
        expect(decodeBigBitExtended(bitset(0b01010, 5).toReader(), 3)).toEqual(
          10n,
        );
        expect(decodeBigBitExtended(bitset(0b01111, 5).toReader(), 3)).toEqual(
          15n,
        );
        expect(
          decodeBigBitExtended(bitset(0b0011000, 7).toReader(), 3),
        ).toEqual(16n);
        expect(
          decodeBigBitExtended(bitset(0b0011111, 7).toReader(), 3),
        ).toEqual(23n);
        expect(
          decodeBigBitExtended(bitset(0b0111000, 7).toReader(), 3),
        ).toEqual(24n);
      });
    });
    it('encodes 32-bit round trip', () => {
      const samples = 100;
      for (let i = 0; i < samples; i++) {
        const val =
          testRandom.getRandomBits(testRandom.getRandomInteger(33, 1)) >> 0;
        const bitCount = testRandom.getRandomInteger(32);
        if (val === 0 && bitCount === 0) {
          // can't encode 0/0
          continue;
        }
        let encoded: BitSet;
        let decoded: number;
        try {
          encoded = encodeBitExtended(val, bitCount);
          decoded = decodeBitExtended(encoded.toReader(), bitCount);
          throwUnless(decoded).toBe(val);
        } catch (e) {
          console.log('32-bit bit-extended encoding failed.\n%o', {
            val,
            bitCount,
          });
          throw e;
        }
      }
    });
    // fit('single 32-bit round trip', () => {
    //   const val = 4009887196 >> 0;
    //   const bitCount = 10;
    //   const encoded = encodeBitExtended(val, bitCount).bitset;
    //   const decoded = decodeBitExtended(encoded, bitCount);
    //   if (decoded !== val) {
    //     console.log('32-bit bit-extended encoding failed.\n%o', {
    //       val,
    //       bitCount,
    //       decoded,
    //     });
    //     throw new Error('32-bit round trip failed. See logs');
    //   }
    // });
    it('encodes bigint round trip', () => {
      const samples = 100;
      for (let i = 0; i < samples; i++) {
        const val = testRandom.getRandomBigBits(
          testRandom.getRandomInteger(1000, 1),
        );
        const bitCount = testRandom.getRandomInteger(32);
        if (val === 0n && bitCount === 0) {
          // can't encode 0/0
          continue;
        }
        const encoded = encodeBitExtended(val, bitCount);
        const decoded = decodeBigBitExtended(encoded.toReader(), bitCount);
        if (decoded !== val) {
          console.log('bigint bit-extended encoding failed.\n%o', {
            val,
            bitCount,
          });
          throw new Error('32-bit round trip failed. See logs');
        }
      }
    });
  });
  describe('Interleave encoding', () => {
    describe('encode', () => {
      it('encodes interleave', () => {
        expect(InterleaveCoder.encode(-1 >>> 1)).toBe(-2);
        expect(InterleaveCoder.encode(3)).toBe(6);
        expect(InterleaveCoder.encode(2)).toBe(4);
        expect(InterleaveCoder.encode(1)).toBe(2);
        expect(InterleaveCoder.encode(0)).toBe(0);
        expect(InterleaveCoder.encode(-1)).toBe(1);
        expect(InterleaveCoder.encode(-2)).toBe(3);
        expect(InterleaveCoder.encode(-3)).toBe(5);
        expect(InterleaveCoder.encode(1 << 31)).toBe(-1);
      });
    });
    describe('decode', () => {
      it('decodes interleave', () => {
        expect(InterleaveCoder.decode(-2)).toBe(-1 >>> 1);
        expect(InterleaveCoder.decode(6)).toBe(3);
        expect(InterleaveCoder.decode(4)).toBe(2);
        expect(InterleaveCoder.decode(2)).toBe(1);
        expect(InterleaveCoder.decode(0)).toBe(0);
        expect(InterleaveCoder.decode(1)).toBe(-1);
        expect(InterleaveCoder.decode(3)).toBe(-2);
        expect(InterleaveCoder.decode(5)).toBe(-3);
        expect(InterleaveCoder.decode(-1)).toBe(1 << 31);
      });
    });
  });
  describe('Delta Coding', () => {
    describe('encode', () => {
      it('encodes delta', () => {
        expect(DeltaCoder.encode(0, 5)).toBe(9);
        expect(DeltaCoder.encode(1, 5)).toBe(7);
        expect(DeltaCoder.encode(2, 5)).toBe(5);
        expect(DeltaCoder.encode(3, 5)).toBe(3);
        expect(DeltaCoder.encode(4, 5)).toBe(1);
        expect(DeltaCoder.encode(5, 5)).toBe(0);
        expect(DeltaCoder.encode(6, 5)).toBe(2);
        expect(DeltaCoder.encode(7, 5)).toBe(4);
        expect(DeltaCoder.encode(8, 5)).toBe(6);
        expect(DeltaCoder.encode(9, 5)).toBe(8);
        expect(DeltaCoder.encode(10, 5)).toBe(10);
        expect(DeltaCoder.encode(11, 5)).toBe(11);
        expect(DeltaCoder.encode(12, 5)).toBe(12);
      });
      it('encodes delta with min', () => {
        expect(DeltaCoder.encode(5, 8, 5)).toBe(5);
        expect(DeltaCoder.encode(6, 8, 5)).toBe(3);
        expect(DeltaCoder.encode(7, 8, 5)).toBe(1);
        expect(DeltaCoder.encode(8, 8, 5)).toBe(0);
        expect(DeltaCoder.encode(9, 8, 5)).toBe(2);
        expect(DeltaCoder.encode(10, 8, 5)).toBe(4);
        expect(DeltaCoder.encode(11, 8, 5)).toBe(6);
        expect(DeltaCoder.encode(12, 8, 5)).toBe(7);
        expect(DeltaCoder.encode(13, 8, 5)).toBe(8);
        expect(DeltaCoder.encode(14, 8, 5)).toBe(9);
      });
    });
    describe('decode', () => {
      it('decodes delta', () => {
        expect(DeltaCoder.decode(0, 8, 5)).toBe(8);
        expect(DeltaCoder.decode(1, 8, 5)).toBe(7);
        expect(DeltaCoder.decode(2, 8, 5)).toBe(9);
        expect(DeltaCoder.decode(3, 8, 5)).toBe(6);
        expect(DeltaCoder.decode(4, 8, 5)).toBe(10);
        expect(DeltaCoder.decode(5, 8, 5)).toBe(5);
        expect(DeltaCoder.decode(6, 8, 5)).toBe(11);
        expect(DeltaCoder.decode(7, 8, 5)).toBe(12);
        expect(DeltaCoder.decode(8, 8, 5)).toBe(13);
        expect(DeltaCoder.decode(9, 8, 5)).toBe(14);
      });
    });
  });
});

describe('encodeGrid', () => {
  it('encodes all ones', () => {
    let input = new BitSet();
    input.toWriter().writeBigBits(-1n, 100);
    expect(encodeGrid(input, 10).toBigInt()).toBe(0b10n);
    input = new BitSet();
    input.toWriter().writeBigBits(-1n, 120);
    expect(encodeGrid(input, 6).toBigInt()).toBe(0b10n);
  });
  it('encodes all zeros', () => {
    let input = new BitSet();
    input.toWriter().writeBigBits(0n, 100);
    expect(encodeGrid(input, 10).toBigInt()).toBe(0b00n);
    input = new BitSet();
    input.toWriter().writeBigBits(0n, 120);
    expect(encodeGrid(input, 6).toBigInt()).toBe(0b00n);
  });
  it('encodes mixed', () => {
    let input = new BitSet();
    input
      .toWriter()
      .writeBatch(0b10101010, 8)
      .writeBatch(0b01010101, 8)
      .writeBatch(0b10101010, 8)
      .writeBatch(0b01010101, 8)
      .writeBatch(0b10101010, 8)
      .writeBatch(0b01010101, 8)
      .writeBatch(0b10101010, 8)
      .writeBatch(0b01010101, 8);
    expect(encodeGrid(input, 8).toBigInt()).toBe(0xd6b5b6b5adb5ad6dad6b7n);
    input = new BitSet();
    input
      .toWriter()
      .writeBatch(0b00001111, 8)
      .writeBatch(0b00001111, 8)
      .writeBatch(0b00001111, 8)
      .writeBatch(0b00001111, 8)
      .writeBatch(0b11110000, 8)
      .writeBatch(0b11110000, 8)
      .writeBatch(0b11110000, 8)
      .writeBatch(0b11110000, 8);
    expect(encodeGrid(input, 8).toBigInt()).toBe(0b100000101n);
  });
});
