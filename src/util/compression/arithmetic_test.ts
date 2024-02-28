import {BitSet, BitSetWriter} from '../io.js';
import {testRandom} from '../random.js';
import {bitset} from '../test_utils.js';
import {
  ArithmeticModel,
  BitExtendedCoder,
  CountCoder,
  FixedProbabilityArithmeticCoder,
  NumberCoder,
  decodeToBitSet,
  decodeValue,
  decodeValues,
  encodeToBitSet,
  encodeValueToBitSet,
  encodeValuesToBitSet,
} from './arithmetic.js';
import {combinations} from '../combinitorics.js';
import {reverseBits} from '../utils.js';

describe('Arithmetic Coding', () => {
  describe('with trailing bits', () => {
    function encode(bitset: BitSet, p: number, bitCount?: number): BitSet {
      return encodeToBitSet(
        bitset.toReader(),
        new FixedProbabilityArithmeticCoder(p, bitCount),
        new BitSetWriter(),
      );
    }
    function decode(bitset: BitSet, p: number, bitCount?: number): BitSet {
      return decodeToBitSet(
        bitset.toReader(),
        new FixedProbabilityArithmeticCoder(p, bitCount),
        new BitSetWriter(),
      );
    }
    describe('encodeArithmetic', () => {
      it('encodes with a 50/50 model', () => {
        // setLoggingLevel(LoggingLevel.TRACE);
        let bitset = new BitSetWriter().write().bitset;
        expect(encode(bitset, 0.5)).toEqual(bitset);
        bitset = new BitSetWriter().write(0).bitset;
        expect(encode(bitset, 0.5)).toEqual(bitset);
        bitset = new BitSetWriter().writeBatch(0b1011010110, 10).bitset;
        expect(encode(bitset, 0.5)).toEqual(bitset);
        bitset = new BitSetWriter().writeBatch(0b101100101011010, 15).bitset;
        expect(encode(bitset, 0.5)).toEqual(bitset);
        bitset = new BitSetWriter().writeBatch(0xffffffff).bitset;
        expect(encode(bitset, 0.5)).toEqual(bitset);
        bitset = new BitSetWriter().writeBigBits(0xdeadbadbeefcafebaben).bitset;
        expect(encode(bitset, 0.5)).toEqual(bitset);
      });
      it('encodes with a 33/66 model', () => {
        // setLoggingLevel(LoggingLevel.TRACE);
        let bitset = new BitSetWriter().write().bitset;
        let encoded = new BitSetWriter().write().bitset;
        expect(encode(bitset, 1 / 3)).toEqual(encoded);
        bitset = new BitSetWriter().write(0).bitset;
        encoded = new BitSetWriter().writeBatch(0b00, 2).bitset;
        expect(encode(bitset, 1 / 3)).toEqual(encoded);
        bitset = new BitSetWriter().writeBatch(0b101, 3).bitset;
        encoded = new BitSetWriter().writeBatch(0b1110, 4).bitset;
        expect(encode(bitset, 1 / 3)).toEqual(encoded);
        bitset = new BitSetWriter().writeBigBits(0xdeadbadbeefcafebaben).bitset;
        encoded = new BitSetWriter().writeBigBits(
          0x6885e2473d778c3d2n,
          67,
        ).bitset;
        expect(encode(bitset, 1 / 3)).toEqual(encoded);
      });
    });
    describe('decodeArithmetic', () => {
      it('decodes with a 50/50 model', () => {
        // setLoggingLevel(LoggingLevel.TRACE);
        let bitset = new BitSetWriter().write().bitset;
        expect(decode(bitset, 0.5, 1)).toEqual(bitset);
        bitset = new BitSetWriter().write(0).bitset;
        expect(decode(bitset, 0.5, 1)).toEqual(bitset);
        bitset = new BitSetWriter().writeBatch(0b1011010110, 10).bitset;
        expect(decode(bitset, 0.5, 10)).toEqual(bitset);
        bitset = new BitSetWriter().writeBatch(0b101100101011010, 15).bitset;
        expect(decode(bitset, 0.5, 15)).toEqual(bitset);
        bitset = new BitSetWriter().writeBatch(0xffffffff).bitset;
        expect(decode(bitset, 0.5, 32)).toEqual(bitset);
        bitset = new BitSetWriter().writeBigBits(0xdeadbadbeefcafebaben).bitset;
        expect(decode(bitset, 0.5, 76)).toEqual(bitset);
      });
      it('decodes with a 33/66 model', () => {
        // setLoggingLevel(LoggingLevel.TRACE);
        let bitset = new BitSetWriter().write().bitset;
        let decoded = new BitSetWriter().write().bitset;
        expect(decode(bitset, 1 / 3, 1)).toEqual(decoded);
        bitset = new BitSetWriter().writeBatch(0b00, 2).bitset;
        decoded = new BitSetWriter().write(0).bitset;
        expect(decode(bitset, 1 / 3, 1)).toEqual(decoded);
        bitset = new BitSetWriter().writeBatch(0b1110, 4).bitset;
        decoded = new BitSetWriter().writeBatch(0b101, 3).bitset;
        expect(decode(bitset, 1 / 3, 3)).toEqual(decoded);
        bitset = new BitSetWriter().writeBigBits(
          0x6885e2473d778c3d2n,
          67,
        ).bitset;
        decoded = new BitSetWriter().writeBigBits(
          0xdeadbadbeefcafebaben,
        ).bitset;
        expect(decode(bitset, 1 / 3, 76)).toEqual(decoded);
      });
    });
    it('does round trip', () => {
      const samples = 100;
      for (let i = 0; i < samples; i++) {
        const bitCount = testRandom.getRandomInteger(2000, 1);
        const bits = testRandom.getRandomBigBits(BigInt(bitCount));
        const prob = testRandom.getRandomInteger(100, 1) / 100;
        const bitset = new BitSetWriter().writeBigBits(bits, bitCount).bitset;
        let encoded: BitSet | undefined = undefined;
        let decoded: BitSet | undefined = undefined;
        try {
          encoded = encode(bitset, prob);
          decoded = decode(encoded, prob, bitCount);
          throwUnless(decoded).toEqual(bitset);
        } catch (e) {
          console.log('Error in round trip:\n%o', {
            prob,
            bits: bits.toString(2),
            bitCount,
            decoded: decoded?.toBigInt().toString(2),
          });
          throw e;
        }
      }
    });
    // fit('test one sample', () => {
    //   setLoggingLevel(LoggingLevel.TRACE);
    //   const bitCount = 3;
    //   const bits = 0b110n;
    //   const prob = 0.1;
    //   const bitset = new BitSetWriter().writeBigBits(bits, bitCount).bitset;
    //   let encoded: BitSet | undefined = undefined;
    //   let decoded: BitSet | undefined = undefined;
    //   try {
    //     encoded = encode(bitset, prob);
    //     decoded = decode(encoded, prob, bitCount);
    //     throwUnless(decoded).toEqual(bitset);
    //   } catch (e) {
    //     console.log('Error in round trip:\n%o', {
    //       prob,
    //       bits: bits.toString(2),
    //       bitCount,
    //       decoded: decoded?.toBigInt().toString(2),
    //     });
    //     throw e;
    //   }
    // });
  });
  describe('without trailing bits', () => {
    function encode(bitset: BitSet, p: number, bitCount?: number): BitSet {
      return encodeToBitSet(
        bitset.toReader(),
        new FixedProbabilityArithmeticCoder(p, bitCount),
      );
    }
    function decode(bitset: BitSet, p: number, bitCount?: number): BitSet {
      return decodeToBitSet(
        bitset.toReader(),
        new FixedProbabilityArithmeticCoder(p, bitCount),
      );
    }
    describe('encodeArithmetic', () => {
      it('encodes with a 50/50 model', () => {
        // setLoggingLevel(LoggingLevel.TRACE);
        let bitset = new BitSetWriter().write().bitset;
        expect(encode(bitset, 0.5)).toEqual(bitset);
        bitset = new BitSetWriter().write(0).bitset;
        expect(encode(bitset, 0.5)).toEqual(new BitSet());
        bitset = new BitSetWriter().writeBatch(0b1011010110, 10).bitset;
        expect(encode(bitset, 0.5)).toEqual(bitset);
        bitset = new BitSetWriter().writeBatch(0b101100101011010, 15).bitset;
        expect(encode(bitset, 0.5)).toEqual(bitset);
        bitset = new BitSetWriter().writeBatch(0xffffffff).bitset;
        expect(encode(bitset, 0.5)).toEqual(bitset);
        bitset = new BitSetWriter().writeBigBits(0xdeadbadbeefcafebaben).bitset;
        expect(encode(bitset, 0.5)).toEqual(bitset);
      });
      it('encodes with a 33/66 model', () => {
        // setLoggingLevel(LoggingLevel.TRACE);
        let bitset = new BitSetWriter().write().bitset;
        let encoded = new BitSetWriter().write().bitset;
        expect(encode(bitset, 1 / 3)).toEqual(encoded);
        bitset = new BitSetWriter().write(0).bitset;
        encoded = new BitSetWriter().bitset;
        expect(encode(bitset, 1 / 3)).toEqual(encoded);
        bitset = new BitSetWriter().writeBatch(0b101, 3).bitset;
        encoded = new BitSetWriter().writeBatch(0b1, 1).bitset;
        expect(encode(bitset, 1 / 3)).toEqual(encoded);
        bitset = new BitSetWriter().writeBigBits(0xdeadbadbeefcafebaben).bitset;
        encoded = new BitSetWriter().writeBigBits(0x1885e2473d778c3d2n).bitset;
        expect(encode(bitset, 1 / 3)).toEqual(encoded);
      });
    });
    describe('decodeArithmetic', () => {
      it('decodes with a 50/50 model', () => {
        // setLoggingLevel(LoggingLevel.TRACE);
        let bitset = new BitSetWriter().write().bitset;
        expect(decode(bitset, 0.5, 1)).toEqual(bitset);
        bitset = new BitSetWriter().write(0).bitset;
        expect(decode(new BitSet(), 0.5, 1)).toEqual(bitset);
        bitset = new BitSetWriter().writeBatch(0b1011010110, 10).bitset;
        expect(decode(bitset, 0.5, 10)).toEqual(bitset);
        bitset = new BitSetWriter().writeBatch(0b101100101011010, 15).bitset;
        expect(decode(bitset, 0.5, 15)).toEqual(bitset);
        bitset = new BitSetWriter().writeBatch(0xffffffff).bitset;
        expect(decode(bitset, 0.5, 32)).toEqual(bitset);
        bitset = new BitSetWriter().writeBigBits(0xdeadbadbeefcafebaben).bitset;
        expect(decode(bitset, 0.5, 76)).toEqual(bitset);
      });
      it('decodes with a 33/66 model', () => {
        // setLoggingLevel(LoggingLevel.TRACE);
        let bitset = new BitSetWriter().write().bitset;
        let decoded = new BitSetWriter().write().bitset;
        expect(decode(bitset, 1 / 3, 1)).toEqual(decoded);
        bitset = new BitSetWriter().bitset;
        decoded = new BitSetWriter().write(0).bitset;
        expect(decode(bitset, 1 / 3, 1)).toEqual(decoded);
        bitset = new BitSetWriter().writeBatch(0b1, 1).bitset;
        decoded = new BitSetWriter().writeBatch(0b101, 3).bitset;
        expect(decode(bitset, 1 / 3, 3)).toEqual(decoded);
        bitset = new BitSetWriter().writeBigBits(0x1885e2473d778c3d2n).bitset;
        decoded = new BitSetWriter().writeBigBits(
          0xdeadbadbeefcafebaben,
        ).bitset;
        expect(decode(bitset, 1 / 3, 76)).toEqual(decoded);
      });
    });
    it('does round trip', () => {
      const samples = 100;
      for (let i = 0; i < samples; i++) {
        const bitCount = testRandom.getRandomInteger(20, 1);
        const bits = testRandom.getRandomBigBits(BigInt(bitCount));
        const prob = testRandom.getRandomInteger(10, 1) / 10;
        const bitset = new BitSetWriter().writeBigBits(bits, bitCount).bitset;
        let encoded: BitSet | undefined = undefined;
        let decoded: BitSet | undefined = undefined;
        try {
          encoded = encode(bitset, prob);
          decoded = decode(encoded, prob, bitCount);
          throwUnless(decoded).toEqual(bitset);
        } catch (e) {
          console.log('Error in round trip:\n%o', {
            prob,
            bits: bits.toString(2),
            bitCount,
            decoded: decoded?.toBigInt().toString(2),
          });
          throw e;
        }
      }
    });
    // fit('test one sample', () => {
    //   // setLoggingLevel(LoggingLevel.TRACE);
    //   const bitCount = 8;
    //   const bits = 0b01101001n;
    //   const prob = 4 / 10;
    //   const bitset = new BitSetWriter().writeBigBits(bits, bitCount).bitset;
    //   let encoded: BitSet | undefined = undefined;
    //   let decoded: BitSet | undefined = undefined;
    //   try {
    //     encoded = encode(bitset, prob);
    //     decoded = decode(encoded, prob, bitCount);
    //     throwUnless(decoded).toEqual(bitset);
    //   } catch (e) {
    //     console.log('Error in round trip:\n%o', {
    //       prob,
    //       bitCount,
    //       bits: bits.toString(2),
    //       encoded: encoded?.toString(),
    //       decoded: decoded?.toString(),
    //     });
    //     throw e;
    //   }
    // });
  });
  describe('CountCoder', () => {
    describe('without terminator', () => {
      it('encodes 4C2 with no terminator', () => {
        const coder = new CountCoder(4, 2);

        let input = new BitSetWriter().writeBatch(0b1100, 4).bitset;
        let encoded = encodeToBitSet(input.toReader(), coder);
        let expected = new BitSetWriter().writeBatch(0b0, 0).bitset;
        expect(encoded).toEqual(expected);

        input = new BitSetWriter().writeBatch(0b1010, 4).bitset;
        encoded = encodeToBitSet(input.toReader(), coder);
        expected = new BitSetWriter().writeBatch(0b10, 2).bitset;
        expect(encoded).toEqual(expected);

        input = new BitSetWriter().writeBatch(0b1001, 4).bitset;
        encoded = encodeToBitSet(input.toReader(), coder);
        expected = new BitSetWriter().writeBatch(0b1, 1).bitset;
        expect(encoded).toEqual(expected);

        input = new BitSetWriter().writeBatch(0b0110, 4).bitset;
        encoded = encodeToBitSet(input.toReader(), coder);
        expected = new BitSetWriter().writeBatch(0b110, 3).bitset;
        expect(encoded).toEqual(expected);

        input = new BitSetWriter().writeBatch(0b0101, 4).bitset;
        encoded = encodeToBitSet(input.toReader(), coder);
        expected = new BitSetWriter().writeBatch(0b11, 2).bitset;
        expect(encoded).toEqual(expected);

        input = new BitSetWriter().writeBatch(0b0011, 4).bitset;
        encoded = encodeToBitSet(input.toReader(), coder);
        expected = new BitSetWriter().writeBatch(0b111, 3).bitset;
        expect(encoded).toEqual(expected);
      });
      it('decodes 4C2 with no terminator', () => {
        const coder = new CountCoder(4, 2);

        let input = new BitSetWriter().writeBatch(0b0, 0).bitset;
        let decoded = decodeToBitSet(input.toReader(), coder);
        let expected = new BitSetWriter().writeBatch(0b1100, 4).bitset;
        expect(decoded).toEqual(expected);

        input = new BitSetWriter().writeBatch(0b10, 2).bitset;
        decoded = decodeToBitSet(input.toReader(), coder);
        expected = new BitSetWriter().writeBatch(0b1010, 4).bitset;
        expect(decoded).toEqual(expected);

        input = new BitSetWriter().writeBatch(0b1, 1).bitset;
        decoded = decodeToBitSet(input.toReader(), coder);
        expected = new BitSetWriter().writeBatch(0b1001, 4).bitset;
        expect(decoded).toEqual(expected);

        input = new BitSetWriter().writeBatch(0b110, 3).bitset;
        decoded = decodeToBitSet(input.toReader(), coder);
        expected = new BitSetWriter().writeBatch(0b0110, 4).bitset;
        expect(decoded).toEqual(expected);

        input = new BitSetWriter().writeBatch(0b11, 2).bitset;
        decoded = decodeToBitSet(input.toReader(), coder);
        expected = new BitSetWriter().writeBatch(0b0101, 4).bitset;
        expect(decoded).toEqual(expected);

        input = new BitSetWriter().writeBatch(0b111, 3).bitset;
        decoded = decodeToBitSet(input.toReader(), coder);
        expected = new BitSetWriter().writeBatch(0b0011, 4).bitset;
        expect(decoded).toEqual(expected);
      });
      it('round trip', () => {
        const samples = 100;
        for (let i = 0; i < samples; i++) {
          const n = testRandom.getRandomInteger(2000);
          const input = new BitSet();
          input.length = n;
          let z = 0;
          for (let j = 0; j < n; j++) {
            if (testRandom.getRandomBits(1)) {
              input.setBit(j);
            } else {
              z++;
            }
          }
          const bits = input.toBigInt();
          const coder = new CountCoder(n, z);
          let encoded: BitSet | undefined = undefined;
          let decoded: BitSet | undefined = undefined;
          try {
            encoded = encodeToBitSet(input.toReader(), coder);
            decoded = decodeToBitSet(encoded.toReader(), coder);
            throwUnless(decoded).toEqual(input);
            expect(encoded.length).toBeLessThanOrEqual(
              combinations(n, z).toString(2).length,
            );
          } catch (e) {
            console.log('Error in round trip: %o', {
              n,
              z,
              bits: bits.toString(2),
              encoded: encoded?.toBigInt().toString(2),
              decoded: decoded?.toBigInt().toString(2),
            });
            throw e;
          }
        }
      });
      // fit('single sample', () => {
      //   const n = 1;
      //   const input = new BitSet(n);
      //   input.length = n;
      //   const z = 0;
      //   const bits = 1n;
      //   input.setBigBits(bits, 0);
      //   const coder = new CountCoder(n, z);
      //   let encoded: BitSet | undefined = undefined;
      //   let decoded: BitSet | undefined = undefined;
      //   try {
      //     encoded = encodeToBitSet(input.toReader(), coder);
      //     decoded = decodeToBitSet(encoded.toReader(), coder);
      //     throwUnless(decoded).toEqual(input);
      //     expect(encoded.length).toBeLessThanOrEqual(
      //       combinations(n, z).toString(2).length
      //     );
      //   } catch (e) {
      //     console.log('Error in round trip: %o', {
      //       n,
      //       z,
      //       bits: bits.toString(2),
      //       encoded: encoded?.toBigInt().toString(2),
      //       decoded: decoded?.toBigInt().toString(2),
      //     });
      //     throw e;
      //   }
      // });
    });
    describe('with terminator', () => {
      it('encodes 4C2', () => {
        // setLoggingLevel(LoggingLevel.TRACE);
        const coder = new CountCoder(4, 2);

        let input = new BitSetWriter().writeBatch(0b1100, 4).bitset;
        let encoded = encodeToBitSet(
          input.toReader(),
          coder,
          new BitSetWriter(),
        );
        let expected = new BitSetWriter().writeBatch(0b000, 3).bitset;
        expect(encoded).toEqual(expected);

        input = new BitSetWriter().writeBatch(0b1010, 4).bitset;
        encoded = encodeToBitSet(input.toReader(), coder, new BitSetWriter());
        expected = new BitSetWriter().writeBatch(0b0010, 4).bitset;
        expect(encoded).toEqual(expected);

        input = new BitSetWriter().writeBatch(0b1001, 4).bitset;
        encoded = encodeToBitSet(input.toReader(), coder, new BitSetWriter());
        expected = new BitSetWriter().writeBatch(0b001, 3).bitset;
        expect(encoded).toEqual(expected);

        input = new BitSetWriter().writeBatch(0b0110, 4).bitset;
        encoded = encodeToBitSet(input.toReader(), coder, new BitSetWriter());
        expected = new BitSetWriter().writeBatch(0b110, 3).bitset;
        expect(encoded).toEqual(expected);

        input = new BitSetWriter().writeBatch(0b0101, 4).bitset;
        encoded = encodeToBitSet(input.toReader(), coder, new BitSetWriter());
        expected = new BitSetWriter().writeBatch(0b0011, 4).bitset;
        expect(encoded).toEqual(expected);

        input = new BitSetWriter().writeBatch(0b0011, 4).bitset;
        encoded = encodeToBitSet(input.toReader(), coder, new BitSetWriter());
        expected = new BitSetWriter().writeBatch(0b111, 3).bitset;
        expect(encoded).toEqual(expected);
      });
      it('decodes 4C2 with terminator', () => {
        const coder = new CountCoder(4, 2);

        let input = new BitSetWriter().writeBatch(0b000, 3).bitset;
        let decoded = decodeToBitSet(
          input.toReader(),
          coder,
          new BitSetWriter(),
        );
        let expected = new BitSetWriter().writeBatch(0b1100, 4).bitset;
        expect(decoded).toEqual(expected);

        input = new BitSetWriter().writeBatch(0b0010, 4).bitset;
        decoded = decodeToBitSet(input.toReader(), coder, new BitSetWriter());
        expected = new BitSetWriter().writeBatch(0b1010, 4).bitset;
        expect(decoded).toEqual(expected);

        input = new BitSetWriter().writeBatch(0b001, 3).bitset;
        decoded = decodeToBitSet(input.toReader(), coder, new BitSetWriter());
        expected = new BitSetWriter().writeBatch(0b1001, 4).bitset;
        expect(decoded).toEqual(expected);

        input = new BitSetWriter().writeBatch(0b110, 3).bitset;
        decoded = decodeToBitSet(input.toReader(), coder, new BitSetWriter());
        expected = new BitSetWriter().writeBatch(0b0110, 4).bitset;
        expect(decoded).toEqual(expected);

        input = new BitSetWriter().writeBatch(0b0011, 4).bitset;
        decoded = decodeToBitSet(input.toReader(), coder, new BitSetWriter());
        expected = new BitSetWriter().writeBatch(0b0101, 4).bitset;
        expect(decoded).toEqual(expected);

        input = new BitSetWriter().writeBatch(0b111, 3).bitset;
        decoded = decodeToBitSet(input.toReader(), coder, new BitSetWriter());
        expected = new BitSetWriter().writeBatch(0b0011, 4).bitset;
        expect(decoded).toEqual(expected);
      });
      it('round trip', () => {
        const samples = 100;
        for (let i = 0; i < samples; i++) {
          const n = testRandom.getRandomInteger(2000);
          const input = new BitSet();
          input.length = n;
          let z = 0;
          for (let j = 0; j < n; j++) {
            if (testRandom.getRandomBits(1)) {
              input.setBit(j);
            } else {
              z++;
            }
          }
          const bits = input.toBigInt();
          let encoded: BitSet | undefined = undefined;
          let decoded: BitSet | undefined = undefined;
          try {
            const coder = new CountCoder(n, z);
            encoded = encodeToBitSet(
              input.toReader(),
              coder,
              new BitSetWriter(),
            );
            decoded = decodeToBitSet(
              encoded.toReader(),
              coder,
              new BitSetWriter(),
            );
            throwUnless(decoded).toEqual(input);
            throwUnless(encoded.length).toBeLessThanOrEqual(
              combinations(n, z).toString(2).length + 1,
            );
          } catch (e) {
            console.log('Error in round trip: %o', {
              n,
              z,
              bits: bits.toString(2),
              encoded: encoded?.toBigInt().toString(2),
              decoded: decoded?.toBigInt().toString(2),
            });
            throw e;
          }
        }
      });
      // fit('single sample', () => {
      //   setLoggingLevel(LoggingLevel.TRACE);
      //   const n = 9;
      //   const input = new BitSet(0b10000, 9);
      //   input.length = n;
      //   let z = 8;
      //   const bits = input.toBigInt();
      //   let encoded: BitSet | undefined = undefined;
      //   let decoded: BitSet | undefined = undefined;
      //   try {
      //     const coder = new CountCoder(n, z);
      //     encoded = encodeToBitSet(input.toReader(), coder,
      //  new BitSetWriter());
      //     decoded = decodeToBitSet(
      //       encoded.toReader(),
      //       coder,
      //       new BitSetWriter()
      //     );
      //     throwUnless(decoded).toEqual(input);
      //     throwUnless(encoded.length).toBeLessThanOrEqual(
      //       combinations(n, z).toString(2).length + 1
      //     );
      //   } catch (e) {
      //     console.log('Error in round trip: %o', {
      //       n,
      //       z,
      //       bits: bits.toString(2),
      //       encoded: encoded?.toBigInt().toString(2),
      //       decoded: decoded?.toBigInt().toString(2),
      //     });
      //     throw e;
      //   }
      // });
    });
  });
  describe('BitExtendedCoder', () => {
    describe('with stream termination', () => {
      it('encodes within payloadinfo', () => {
        const coder = new BitExtendedCoder(3, 0.1);
        let input = bitset(0b000, 3);
        let expected = bitset(0b0000, 4);
        expect(
          encodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
        input = bitset(0b100, 3);
        expected = bitset(0b0100, 4);
        expect(
          encodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
        input = bitset(0b010, 3);
        expected = bitset(0b0010, 4);
        expect(
          encodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
        input = bitset(0b001, 3);
        expected = bitset(0b0001, 4);
        expect(
          encodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
        input = bitset(0b111, 3);
        expected = bitset(0b0111, 4);
        expect(
          encodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
      });
      it('decodes within payloadinfo', () => {
        const coder = new BitExtendedCoder(3, 0.1);
        let input = bitset(0b0000, 4);
        let expected = bitset(0b000, 3);
        expect(
          decodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
        input = bitset(0b0100, 4);
        expected = bitset(0b100, 3);
        expect(
          decodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
        input = bitset(0b0010, 4);
        expected = bitset(0b010, 3);
        expect(
          decodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
        input = bitset(0b0001, 4);
        expected = bitset(0b001, 3);
        expect(
          decodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
        input = bitset(0b0111, 4);
        expected = bitset(0b111, 3);
        expect(
          decodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
      });
      it('encodes the extra bit exactly', () => {
        const coder = new BitExtendedCoder(3, 0.1);
        let input = bitset(0b1000, 4);
        let expected = bitset(0b01000, 5);
        expect(
          encodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
        input = bitset(0b1100, 4);
        expected = bitset(0b01100, 5);
        expect(
          encodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
        input = bitset(0b1010, 4);
        expected = bitset(0b01010, 5);
        expect(
          encodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
        input = bitset(0b1001, 4);
        expected = bitset(0b01001, 5);
        expect(
          encodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
        input = bitset(0b1111, 4);
        expected = bitset(0b01111, 5);
        expect(
          encodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
      });
      it('decodes the extra bit exactly', () => {
        const coder = new BitExtendedCoder(3, 0.1);
        let input = bitset(0b01000, 5);
        let expected = bitset(0b1000, 4);
        expect(
          decodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
        input = bitset(0b01100, 5);
        expected = bitset(0b1100, 4);
        expect(
          decodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
        input = bitset(0b01010, 5);
        expected = bitset(0b1010, 4);
        expect(
          decodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
        input = bitset(0b01001, 5);
        expected = bitset(0b1001, 4);
        expect(
          decodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
        input = bitset(0b01111, 5);
        expected = bitset(0b1111, 4);
        expect(
          decodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
      });
      it('encodes additional extra bits', () => {
        const coder = new BitExtendedCoder(3, 0.1);
        let input = bitset(0b11010, 5);
        let expected = bitset(0b0111111010, 10);
        expect(
          encodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
        input = bitset(0b10010, 5);
        expected = bitset(0b101111010, 9);
        expect(
          encodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
      });
      it('decodes additional extra bits', () => {
        const coder = new BitExtendedCoder(3, 0.1);
        let input = bitset(0b0111111010, 10);
        let expected = bitset(0b11010, 5);
        expect(
          decodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
        input = bitset(0b101111010, 9);
        expected = bitset(0b10010, 5);
        expect(
          decodeToBitSet(input.toReader(), coder, new BitSetWriter()),
        ).toEqual(expected);
      });
      it('encodes 32-bit round trip', () => {
        const samples = 100;
        for (let i = 0; i < samples; i++) {
          const val =
            testRandom.getRandomBits(testRandom.getRandomInteger(33, 1)) >> 0;
          const bitCount = testRandom.getRandomInteger(32);
          const p = testRandom.getRandomDouble();
          const coder = new BitExtendedCoder(bitCount, p);
          if (val === 0 && bitCount === 0) {
            // can't encode 0/0
            continue;
          }
          let encoded: BitSet | undefined = undefined;
          let decoded: number | undefined = undefined;
          try {
            encoded = encodeValueToBitSet(val, coder, new BitSetWriter());
            decoded = decodeValue(encoded.toReader(), coder);
            throwUnless(decoded).toBe(val);
          } catch (e) {
            console.log('32-bit bit-extended encoding failed.\n%o', {
              val,
              bitCount,
              p,
              encoded: encoded?.toBigInt().toString(2),
              decoded,
            });
            throw e;
          }
        }
      });
      // fit('single 32-bit round trip', () => {
      //   const val = 4;
      //   const bitCount = 6;
      //   const p = 0.9808556995457969;
      //   const coder = new BitExtendedCoder(bitCount, p);
      //   let encoded: BitSet | undefined = undefined;
      //   let decoded: number | undefined = undefined;
      //   try {
      //     encoded = encodeValueToBitSet(val, coder, new BitSetWriter());
      //     decoded = decodeValue(encoded.toReader(), coder);
      //     throwUnless(decoded).toBe(val);
      //   } catch (e) {
      //     console.log('32-bit bit-extended encoding failed.\n%o', {
      //       val,
      //       bitCount,
      //       p,
      //       encoded: encoded?.toBigInt().toString(2),
      //       decoded,
      //     });
      //     throw e;
      //   }
      // });
      it('encodes bigint round trip', () => {
        const samples = 100;
        for (let i = 0; i < samples; i++) {
          const val = testRandom.getRandomBigBits(
            testRandom.getRandomBigInteger(512n, 1n),
          );
          const bitCount = testRandom.getRandomInteger(32);
          const p = testRandom.getRandomDouble();
          const coder = new BitExtendedCoder(bitCount, p).asBigintCoder();
          if (val === 0n && bitCount === 0) {
            // can't encode 0/0
            continue;
          }
          let encoded: BitSet | undefined = undefined;
          let decoded: bigint | undefined = undefined;
          try {
            encoded = encodeValueToBitSet(val, coder, new BitSetWriter());
            decoded = decodeValue(encoded.toReader(), coder);
            throwUnless(decoded).toBe(val);
          } catch (e) {
            console.log('32-bit bit-extended encoding failed.\n%o', {
              val,
              bitCount,
              p,
              encoded: encoded?.toBigInt().toString(2),
              decoded,
            });
            throw e;
          }
        }
      });
    });
    describe('without stream termination', () => {
      it('encodes within payloadinfo', () => {
        const coder = new BitExtendedCoder(3, 0.1);
        let input = bitset(0b000, 3);
        expect(encodeToBitSet(input.toReader(), coder)).toEqual(input.trim());
        input = bitset(0b100, 3);
        expect(encodeToBitSet(input.toReader(), coder)).toEqual(input.trim());
        input = bitset(0b010, 3);
        expect(encodeToBitSet(input.toReader(), coder)).toEqual(input.trim());
        input = bitset(0b001, 3);
        expect(encodeToBitSet(input.toReader(), coder)).toEqual(input.trim());
        input = bitset(0b111, 3);
        expect(encodeToBitSet(input.toReader(), coder)).toEqual(input.trim());
      });
      it('decodes within payloadinfo', () => {
        const coder = new BitExtendedCoder(3, 0.1);
        let expected = bitset(0b000, 3);
        let input = expected.clone().trim();
        expect(decodeToBitSet(input.toReader(), coder)).toEqual(expected);
        expected = bitset(0b100, 3);
        input = expected.clone().trim();
        expect(decodeToBitSet(input.toReader(), coder)).toEqual(expected);
        expected = bitset(0b010, 3);
        input = expected.clone().trim();
        expect(decodeToBitSet(input.toReader(), coder)).toEqual(expected);
        expected = bitset(0b001, 3);
        input = expected.clone().trim();
        expect(decodeToBitSet(input.toReader(), coder)).toEqual(expected);
        expected = bitset(0b111, 3);
        input = expected.clone().trim();
        expect(decodeToBitSet(input.toReader(), coder)).toEqual(expected);
      });
      it('encodes the extra bit exactly', () => {
        const coder = new BitExtendedCoder(3, 0.1);
        let input = bitset(0b1000, 4);
        let expected = bitset(0b1000, 4);
        expect(encodeToBitSet(input.toReader(), coder)).toEqual(expected);
        input = bitset(0b1100, 4);
        expected = bitset(0b1100, 4);
        expect(encodeToBitSet(input.toReader(), coder)).toEqual(expected);
        input = bitset(0b1010, 4);
        expected = bitset(0b1010, 4);
        expect(encodeToBitSet(input.toReader(), coder)).toEqual(expected);
        input = bitset(0b1001, 4);
        expected = bitset(0b1001, 4);
        expect(encodeToBitSet(input.toReader(), coder)).toEqual(expected);
        input = bitset(0b1111, 4);
        expected = bitset(0b1111, 4);
        expect(encodeToBitSet(input.toReader(), coder)).toEqual(expected);
      });
      it('decodes the extra bit exactly', () => {
        const coder = new BitExtendedCoder(3, 0.1);
        let input = bitset(0b1000, 4);
        let expected = bitset(0b1000, 4);
        expect(decodeToBitSet(input.toReader(), coder)).toEqual(expected);
        input = bitset(0b1100, 4);
        expected = bitset(0b1100, 4);
        expect(decodeToBitSet(input.toReader(), coder)).toEqual(expected);
        input = bitset(0b1010, 4);
        expected = bitset(0b1010, 4);
        expect(decodeToBitSet(input.toReader(), coder)).toEqual(expected);
        input = bitset(0b1001, 4);
        expected = bitset(0b1001, 4);
        expect(decodeToBitSet(input.toReader(), coder)).toEqual(expected);
        input = bitset(0b1111, 4);
        expected = bitset(0b1111, 4);
        expect(decodeToBitSet(input.toReader(), coder)).toEqual(expected);
      });
      it('encodes additional extra bits', () => {
        const coder = new BitExtendedCoder(3, 0.1);
        let input = bitset(0b11010, 5);
        let expected = bitset(0b111111010, 9);
        expect(encodeToBitSet(input.toReader(), coder)).toEqual(expected);
        input = bitset(0b10010, 5);
        expected = bitset(0b11111010, 8);
        expect(encodeToBitSet(input.toReader(), coder)).toEqual(expected);
      });
      it('decodes additional extra bits', () => {
        const coder = new BitExtendedCoder(3, 0.1);
        let input = bitset(0b111111010, 9);
        let expected = bitset(0b11010, 5);
        expect(decodeToBitSet(input.toReader(), coder)).toEqual(expected);
        input = bitset(0b11111010, 8);
        expected = bitset(0b10010, 5);
        expect(decodeToBitSet(input.toReader(), coder)).toEqual(expected);
      });
    });
  });
  describe('NumberCoder', () => {
    it('compresses three values with equal probability', () => {
      const coder = new NumberCoder(3);
      let v2 = 0;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          for (let k = 0; k < 3; k++, v2++) {
            const v1 = Math.ceil((v2 * 32) / 27);
            let expected = new BitSetWriter()
              .writeBatch(reverseBits(v1) >>> 27, 5)
              .bitset.trim();
            if (((v1 + 1) * 27) / 32 < v2 + 1) {
              const alt = new BitSetWriter()
                .writeBatch(reverseBits(v1 + 1) >>> 27, 5)
                .bitset.trim();
              if (alt.length < expected.length) {
                expected = alt;
              }
            }
            let encoded: BitSet | undefined = undefined;
            try {
              encoded = encodeValuesToBitSet([i, j, k], coder);
              throwUnless(encoded).toEqual(expected);
            } catch (e) {
              console.log('Error in compression. Data: %o', {
                i,
                j,
                k,
                v1,
                v2,
                encoded: encoded?.toBigInt().toString(2),
                expected: expected?.toBigInt().toString(2),
              });
              throw e;
            }
          }
        }
      }
    });
    it('round trip', () => {
      const samples = 100;
      for (let i = 0; i < samples; i++) {
        const max = testRandom.getRandomInteger(200, 1);
        const sampleCount = testRandom.getRandomInteger(2000);
        const input: number[] = [];
        for (let i = 0; i < sampleCount; i++) {
          input.push(testRandom.getRandomInteger(max));
        }
        let encoded: BitSet | undefined = undefined;
        let decoded: number[] | undefined = undefined;
        try {
          const coder = new NumberCoder(max);
          encoded = encodeValuesToBitSet(input, coder);
          decoded = decodeValues(encoded.toReader(), coder, sampleCount);
          throwUnless(decoded).toEqual(input);
          throwUnless(encoded.length).toBeLessThanOrEqual(
            Math.ceil(sampleCount * Math.log2(max)),
          );
        } catch (e) {
          console.log('Round trip fail. Data: %o', {
            max,
            sampleCount,
            input: `[${input.join(',')}]`,
            encoded: encoded?.toBigInt().toString(2),
            decoded: decoded ? `[${decoded.join(',')}]` : undefined,
          });
          throw e;
        }
      }
    });
    // fit('test single', () => {
    //   const max = 6;
    //   const input: number[] = [0, 5, 5, 0];
    //   const sampleCount = input.length;
    //   let encoded: BitSet | undefined = undefined;
    //   let decoded: number[] | undefined = undefined;
    //   try {
    //     const coder = new NumberCoder2(max);
    //     encoded = encodeValueToBitSet(input, coder);
    //     decoded = decodeValues(encoded.toReader(), coder, sampleCount);
    //     throwUnless(decoded).toEqual(input);
    //     throwUnless(encoded.length).toBeLessThanOrEqual(
    //       sampleCount * Math.log2(max) + 1
    //     );
    //   } catch (e) {
    //     console.log('Round trip fail. Data: %o', {
    //       max,
    //       sampleCount,
    //       input: `[${input.join(',')}]`,
    //       encoded: encoded?.toBigInt().toString(2),
    //       decoded: decoded ? `[${decoded.join(',')}]` : undefined,
    //     });
    //     throw e;
    //   }
    // });
  });
  describe('Arithmetic Model', () => {
    it('compresses three values with equal probability', () => {
      const values = [
        new BitSet(0b0, 1),
        new BitSet(0b01, 2),
        new BitSet(0b11, 2),
      ];
      const trinary = new ArithmeticModel([
        {value: values[0], weight: 1},
        {value: values[1], weight: 1},
        {value: values[2], weight: 1},
      ]);
      // Verify that each
      let v2 = 0;
      // Three values, each with p = 1/3 leads to values in the range of 1/27
      // The encoder should find the closest 5-bit approximation with the
      // shortest encoding. We simulate that here by stepping 1/27, and manually
      // finding the closest 5-bit matching value.
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          for (let k = 0; k < 3; k++, v2++) {
            const v1 = Math.ceil((v2 * 32) / 27);
            let expected = new BitSetWriter()
              .writeBatch(reverseBits(v1) >>> 27, 5)
              .bitset.trim();
            if (((v1 + 1) * 27) / 32 < v2 + 1) {
              const alt = new BitSetWriter()
                .writeBatch(reverseBits(v1 + 1) >>> 27, 5)
                .bitset.trim();
              if (alt.length < expected.length) {
                expected = alt;
              }
            }
            let encoded: BitSet | undefined = undefined;
            try {
              encoded = encodeValuesToBitSet(
                [values[i], values[j], values[k]],
                trinary,
              );
              throwUnless(encoded).toEqual(expected);
            } catch (e) {
              console.log('Error in compression. Data: %o', {
                i,
                j,
                k,
                v1,
                v2,
                encoded: encoded?.toBigInt().toString(2),
                expected: expected?.toBigInt().toString(2),
              });
              throw e;
            }
          }
        }
      }
    });
    it('round trip', () => {
      const samples = 100;
      for (let i = 0; i < samples; i++) {
        const symbolCount = testRandom.getRandomInteger(200, 1);
        const bitCount = Math.max(32 - Math.clz32(symbolCount - 1), 1);
        const symbols = Array.from({
          length: symbolCount,
        }).map((v, i) => ({
          value: i,
          weight: testRandom.getRandomBits(32),
        }));
        const sampleCount = testRandom.getRandomInteger(2000);
        const input = new BitSet();
        for (let i = 0; i < sampleCount; i++) {
          input.appendBits(testRandom.getRandomInteger(symbolCount), bitCount);
        }
        let encoded: BitSet | undefined = undefined;
        let decoded: BitSet | undefined = undefined;
        try {
          const model = new ArithmeticModel(
            symbols.map(v => ({
              value: new BitSet(v.value, bitCount),
              weight: v.weight ? v.weight : Number.EPSILON,
            })),
          );
          encoded = encodeToBitSet(input.toReader(), model, sampleCount);
          decoded = decodeToBitSet(encoded.toReader(), model, sampleCount);
          throwUnless(decoded).toEqual(input);
        } catch (e) {
          console.log('Round trip fail. Data: %o', {
            symbolCount,
            bitCount,
            symbols,
            sampleCount,
            input: input.toBigInt().toString(2),
            encoded: encoded?.toBigInt().toString(2),
            decoded: decoded?.toBigInt().toString(2),
          });
          throw e;
        }
      }
    });
    // fit('single sample', () => {
    //   // setLoggingLevel(LoggingLevel.TRACE);
    //   const symbolCount = 3;
    //   const bitCount = 32 - Math.clz32(symbolCount - 1);
    //   const symbols = [
    //     { value: 0, weight: 1276278376 },
    //     { value: 1, weight: 3722219259 },
    //     { value: 2, weight: 242691059 },
    //   ];
    //   const sampleCount = 7;
    //   const input = new BitSetWriter().writeBigBits(
    //     0b01001010101001n
    //   ).bitset;
    //   input.length = sampleCount * bitCount;
    //   let encoded: BitSet | undefined = undefined;
    //   let decoded: BitSet | undefined = undefined;
    //   try {
    //     const model = new ArithmeticModel(
    //       symbols.map(v => ({
    //         value: new BitSet(v.value, bitCount),
    //         weight: v.weight ? v.weight : Number.EPSILON,
    //       }))
    //     );
    //     encoded = encodeToBitSet(input.toReader(), model, sampleCount);
    //     decoded = decodeToBitSet(encoded.toReader(), model, sampleCount);
    //     throwUnless(decoded).toEqual(input);
    //   } catch (e) {
    //     console.log('Round trip fail. Data: %o', {
    //       symbolCount,
    //       bitCount,
    //       symbols,
    //       sampleCount,
    //       input: input.toBigInt().toString(2),
    //       encoded: encoded?.toBigInt().toString(2),
    //       decoded: decoded?.toBigInt().toString(2),
    //     });
    //     throw e;
    //   }
    // });
  });
});
