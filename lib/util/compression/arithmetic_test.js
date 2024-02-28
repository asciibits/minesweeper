import { BitSet, BitSetWriter } from '../io.js';
import { testRandom } from '../random.js';
import { bitset } from '../test_utils.js';
import { ArithmeticModel, BitExtendedCoder, CountCoder, FixedProbabilityArithmeticCoder, NumberCoder, decodeToBitSet, decodeValue, decodeValues, encodeToBitSet, encodeValueToBitSet, } from './arithmetic.js';
import { combinations } from '../combinitorics.js';
import { reverseBits } from '../utils.js';
describe('Arithmetic Coding', () => {
    describe('with trailing bits', () => {
        function encode(bitset, p, bitCount) {
            return encodeToBitSet(bitset.toReader(), new FixedProbabilityArithmeticCoder(p, bitCount), new BitSetWriter());
        }
        function decode(bitset, p, bitCount) {
            return decodeToBitSet(bitset.toReader(), new FixedProbabilityArithmeticCoder(p, bitCount), new BitSetWriter());
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
                encoded = new BitSetWriter().writeBigBits(0x6885e2473d778c3d2n, 67).bitset;
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
                bitset = new BitSetWriter().writeBigBits(0x6885e2473d778c3d2n, 67).bitset;
                decoded = new BitSetWriter().writeBigBits(0xdeadbadbeefcafebaben).bitset;
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
                let encoded = undefined;
                let decoded = undefined;
                try {
                    encoded = encode(bitset, prob);
                    decoded = decode(encoded, prob, bitCount);
                    throwUnless(decoded).toEqual(bitset);
                }
                catch (e) {
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
        function encode(bitset, p, bitCount) {
            return encodeToBitSet(bitset.toReader(), new FixedProbabilityArithmeticCoder(p, bitCount));
        }
        function decode(bitset, p, bitCount) {
            return decodeToBitSet(bitset.toReader(), new FixedProbabilityArithmeticCoder(p, bitCount));
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
                decoded = new BitSetWriter().writeBigBits(0xdeadbadbeefcafebaben).bitset;
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
                let encoded = undefined;
                let decoded = undefined;
                try {
                    encoded = encode(bitset, prob);
                    decoded = decode(encoded, prob, bitCount);
                    throwUnless(decoded).toEqual(bitset);
                }
                catch (e) {
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
                        }
                        else {
                            z++;
                        }
                    }
                    const bits = input.toBigInt();
                    const coder = new CountCoder(n, z);
                    let encoded = undefined;
                    let decoded = undefined;
                    try {
                        encoded = encodeToBitSet(input.toReader(), coder);
                        decoded = decodeToBitSet(encoded.toReader(), coder);
                        throwUnless(decoded).toEqual(input);
                        expect(encoded.length).toBeLessThanOrEqual(combinations(n, z).toString(2).length);
                    }
                    catch (e) {
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
                let encoded = encodeToBitSet(input.toReader(), coder, new BitSetWriter());
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
                let decoded = decodeToBitSet(input.toReader(), coder, new BitSetWriter());
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
                        }
                        else {
                            z++;
                        }
                    }
                    const bits = input.toBigInt();
                    let encoded = undefined;
                    let decoded = undefined;
                    try {
                        const coder = new CountCoder(n, z);
                        encoded = encodeToBitSet(input.toReader(), coder, new BitSetWriter());
                        decoded = decodeToBitSet(encoded.toReader(), coder, new BitSetWriter());
                        throwUnless(decoded).toEqual(input);
                        throwUnless(encoded.length).toBeLessThanOrEqual(combinations(n, z).toString(2).length + 1);
                    }
                    catch (e) {
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
                expect(encodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
                input = bitset(0b100, 3);
                expected = bitset(0b0100, 4);
                expect(encodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
                input = bitset(0b010, 3);
                expected = bitset(0b0010, 4);
                expect(encodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
                input = bitset(0b001, 3);
                expected = bitset(0b0001, 4);
                expect(encodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
                input = bitset(0b111, 3);
                expected = bitset(0b0111, 4);
                expect(encodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
            });
            it('decodes within payloadinfo', () => {
                const coder = new BitExtendedCoder(3, 0.1);
                let input = bitset(0b0000, 4);
                let expected = bitset(0b000, 3);
                expect(decodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
                input = bitset(0b0100, 4);
                expected = bitset(0b100, 3);
                expect(decodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
                input = bitset(0b0010, 4);
                expected = bitset(0b010, 3);
                expect(decodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
                input = bitset(0b0001, 4);
                expected = bitset(0b001, 3);
                expect(decodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
                input = bitset(0b0111, 4);
                expected = bitset(0b111, 3);
                expect(decodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
            });
            it('encodes the extra bit exactly', () => {
                const coder = new BitExtendedCoder(3, 0.1);
                let input = bitset(0b1000, 4);
                let expected = bitset(0b01000, 5);
                expect(encodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
                input = bitset(0b1100, 4);
                expected = bitset(0b01100, 5);
                expect(encodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
                input = bitset(0b1010, 4);
                expected = bitset(0b01010, 5);
                expect(encodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
                input = bitset(0b1001, 4);
                expected = bitset(0b01001, 5);
                expect(encodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
                input = bitset(0b1111, 4);
                expected = bitset(0b01111, 5);
                expect(encodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
            });
            it('decodes the extra bit exactly', () => {
                const coder = new BitExtendedCoder(3, 0.1);
                let input = bitset(0b01000, 5);
                let expected = bitset(0b1000, 4);
                expect(decodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
                input = bitset(0b01100, 5);
                expected = bitset(0b1100, 4);
                expect(decodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
                input = bitset(0b01010, 5);
                expected = bitset(0b1010, 4);
                expect(decodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
                input = bitset(0b01001, 5);
                expected = bitset(0b1001, 4);
                expect(decodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
                input = bitset(0b01111, 5);
                expected = bitset(0b1111, 4);
                expect(decodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
            });
            it('encodes additional extra bits', () => {
                const coder = new BitExtendedCoder(3, 0.1);
                let input = bitset(0b11010, 5);
                let expected = bitset(0b0111111010, 10);
                expect(encodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
                input = bitset(0b10010, 5);
                expected = bitset(0b101111010, 9);
                expect(encodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
            });
            it('decodes additional extra bits', () => {
                const coder = new BitExtendedCoder(3, 0.1);
                let input = bitset(0b0111111010, 10);
                let expected = bitset(0b11010, 5);
                expect(decodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
                input = bitset(0b101111010, 9);
                expected = bitset(0b10010, 5);
                expect(decodeToBitSet(input.toReader(), coder, new BitSetWriter())).toEqual(expected);
            });
            it('encodes 32-bit round trip', () => {
                const samples = 100;
                for (let i = 0; i < samples; i++) {
                    const val = testRandom.getRandomBits(testRandom.getRandomInteger(33, 1)) >> 0;
                    const bitCount = testRandom.getRandomInteger(32);
                    const p = testRandom.getRandomDouble();
                    const coder = new BitExtendedCoder(bitCount, p);
                    if (val === 0 && bitCount === 0) {
                        // can't encode 0/0
                        continue;
                    }
                    let encoded = undefined;
                    let decoded = undefined;
                    try {
                        encoded = encodeValueToBitSet(val, coder, new BitSetWriter());
                        decoded = decodeValue(encoded.toReader(), coder);
                        throwUnless(decoded).toBe(val);
                    }
                    catch (e) {
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
                    const val = testRandom.getRandomBigBits(testRandom.getRandomBigInteger(512n, 1n));
                    const bitCount = testRandom.getRandomInteger(32);
                    const p = testRandom.getRandomDouble();
                    const coder = new BitExtendedCoder(bitCount, p).asBigintCoder();
                    if (val === 0n && bitCount === 0) {
                        // can't encode 0/0
                        continue;
                    }
                    let encoded = undefined;
                    let decoded = undefined;
                    try {
                        encoded = encodeValueToBitSet(val, coder, new BitSetWriter());
                        decoded = decodeValue(encoded.toReader(), coder);
                        throwUnless(decoded).toBe(val);
                    }
                    catch (e) {
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
                        let encoded = undefined;
                        try {
                            encoded = encodeValueToBitSet([i, j, k], coder);
                            throwUnless(encoded).toEqual(expected);
                        }
                        catch (e) {
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
                const input = [];
                for (let i = 0; i < sampleCount; i++) {
                    input.push(testRandom.getRandomInteger(max));
                }
                let encoded = undefined;
                let decoded = undefined;
                try {
                    const coder = new NumberCoder(max);
                    encoded = encodeValueToBitSet(input, coder);
                    decoded = decodeValues(encoded.toReader(), coder, sampleCount);
                    throwUnless(decoded).toEqual(input);
                    throwUnless(encoded.length).toBeLessThanOrEqual(Math.ceil(sampleCount * Math.log2(max)));
                }
                catch (e) {
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
                { value: values[0], weight: 1 },
                { value: values[1], weight: 1 },
                { value: values[2], weight: 1 },
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
                        let encoded = undefined;
                        try {
                            encoded = encodeValueToBitSet([values[i], values[j], values[k]], trinary);
                            throwUnless(encoded).toEqual(expected);
                        }
                        catch (e) {
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
                let encoded = undefined;
                let decoded = undefined;
                try {
                    const model = new ArithmeticModel(symbols.map(v => ({
                        value: new BitSet(v.value, bitCount),
                        weight: v.weight ? v.weight : Number.EPSILON,
                    })));
                    encoded = encodeToBitSet(input.toReader(), model, sampleCount);
                    decoded = decodeToBitSet(encoded.toReader(), model, sampleCount);
                    throwUnless(decoded).toEqual(input);
                }
                catch (e) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJpdGhtZXRpY190ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3V0aWwvY29tcHJlc3Npb24vYXJpdGhtZXRpY190ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBQyxNQUFNLEVBQUUsWUFBWSxFQUFDLE1BQU0sVUFBVSxDQUFDO0FBQzlDLE9BQU8sRUFBQyxVQUFVLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFDeEMsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBQ3hDLE9BQU8sRUFDTCxlQUFlLEVBQ2YsZ0JBQWdCLEVBQ2hCLFVBQVUsRUFDViwrQkFBK0IsRUFDL0IsV0FBVyxFQUNYLGNBQWMsRUFDZCxXQUFXLEVBQ1gsWUFBWSxFQUNaLGNBQWMsRUFDZCxtQkFBbUIsR0FDcEIsTUFBTSxpQkFBaUIsQ0FBQztBQUN6QixPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFDakQsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLGFBQWEsQ0FBQztBQUV4QyxRQUFRLENBQUMsbUJBQW1CLEVBQUUsR0FBRyxFQUFFO0lBQ2pDLFFBQVEsQ0FBQyxvQkFBb0IsRUFBRSxHQUFHLEVBQUU7UUFDbEMsU0FBUyxNQUFNLENBQUMsTUFBYyxFQUFFLENBQVMsRUFBRSxRQUFpQjtZQUMxRCxPQUFPLGNBQWMsQ0FDbkIsTUFBTSxDQUFDLFFBQVEsRUFBRSxFQUNqQixJQUFJLCtCQUErQixDQUFDLENBQUMsRUFBRSxRQUFRLENBQUMsRUFDaEQsSUFBSSxZQUFZLEVBQUUsQ0FDbkIsQ0FBQztRQUNKLENBQUM7UUFDRCxTQUFTLE1BQU0sQ0FBQyxNQUFjLEVBQUUsQ0FBUyxFQUFFLFFBQWlCO1lBQzFELE9BQU8sY0FBYyxDQUNuQixNQUFNLENBQUMsUUFBUSxFQUFFLEVBQ2pCLElBQUksK0JBQStCLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxFQUNoRCxJQUFJLFlBQVks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QUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUVsQyxLQUFLLEdBQUcsSUFBSSxZQUFZLEVBQUUsQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztnQkFDeEQsT0FBTyxHQUFHLGNBQWMsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQ2xELFFBQVEsR0FBRyxJQUFJLFlBQVksRUFBRSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO2dCQUMxRCxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUVsQyxLQUFLLEdBQUcsSUFBSSxZQUFZLEVBQUUsQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztnQkFDeEQsT0FBTyxHQUFHLGNBQWMsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQ2xELFFBQVEsR0FBRyxJQUFJLFlBQVksRUFBRSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO2dCQUN6RCxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUVsQyxLQUFLLEdBQUcsSUFBSSxZQUFZLEVBQUUsQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztnQkFDeEQsT0FBTyxHQUFHLGNBQWMsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQ2xELFFBQVEsR0FBRyxJQUFJLFlBQVksRUFBRSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO2dCQUMxRCxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3BDLENBQUMsQ0FBQyxDQUFDO1lBQ0gsRUFBRSxDQUFDLGdDQUFnQyxFQUFFLEdBQUcsRUFBRTtnQkFDeEMsTUFBTSxLQUFLLEdBQUcsSUFBSSxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUVuQyxJQUFJLEtBQUssR0FBRyxJQUFJLFlBQVksRUFBRSxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO2dCQUN6RCxJQUFJLE9BQU8sR0FBRyxjQUFjLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUN0RCxJQUFJLFFBQVEsR0FBRyxJQUFJLFlBQVksRUFBRSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO2dCQUMvRCxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUVsQyxLQUFLLEdBQUcsSUFBSSxZQUFZLEVBQUUsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztnQkFDdEQsT0FBTyxHQUFHLGNBQWMsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQ2xELFFBQVEsR0FBRyxJQUFJLFlBQVksRUFBRSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO2dCQUMzRCxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUVsQyxLQUFLLEdBQUcsSUFBSSxZQUFZLEVBQUUsQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztnQkFDckQsT0FBTyxHQUFHLGNBQWMsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQ2xELFFBQVEsR0FBRyxJQUFJLFlBQVksRUFBRSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO2dCQUMzRCxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUVsQyxLQUFLLEdBQUcsSUFBSSxZQUFZLEVBQUUsQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztnQkFDdkQsT0FBTyxHQUFHLGNBQWMsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQ2xELFFBQVEsR0FBRyxJQUFJLFlBQVksRUFBRSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO2dCQUMzRCxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUVsQyxLQUFLLEdBQUcsSUFBSSxZQUFZLEVBQUUsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztnQkFDdEQsT0FBTyxHQUFHLGNBQWMsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQ2xELFFBQVEsR0FBRyxJQUFJLFlBQVksRUFBRSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO2dCQUMzRCxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUVsQyxLQUFLLEdBQUcsSUFBSSxZQUFZLEVBQUUsQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztnQkFDdkQsT0FBTyxHQUFHLGNBQWMsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQ2xELFFBQVEsR0FBRyxJQUFJLFlBQVksRUFBRSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO2dCQUMzRCxNQUFN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S0FBSyxFQUFFLElBQUksWUFBWSxFQUFFLENBQUMsQ0FDNUQsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3BCLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUN6QixRQUFRLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDN0IsTUFBTSxDQUNKLGNBQWMsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksWUFBWSxFQUFFLENBQUMsQ0FDNUQsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3BCLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUN6QixRQUFRLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDN0IsTUFBTSxDQUNKLGNBQWMsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksWUFBWSxFQUFFLENBQUMsQ0FDNUQsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3BCLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUN6QixRQUFRLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDN0IsTUFBTSxDQUNKLGNBQWMsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksWUFBWSxFQUFFLENBQUMsQ0FDNUQsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3BCLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUN6QixRQUFRLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDN0IsTUFBTSxDQUNKLGNBQWMsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsS0FBSyxFQUFFLElB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RSxDQUFDLENBQUMsQ0FBQztnQkFDL0IsSUFBSSxRQUFRLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDakMsTUFBTSxDQUNKLGNBQWMsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksWUFBWSxFQUFFLENBQUMsQ0FDNUQsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3BCLEtBQUssR0FBRyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUMzQixRQUFRLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDN0IsTUFBTSxDQUNKLGNBQWMsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksWUFBWSxFQUFFLENBQUMsQ0FDNUQsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3BCLEtBQUssR0FBRyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUMzQixRQUFRLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDN0IsTUFBTSxDQUNKLGNBQWMsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksWUFBWSxFQUFFLENBQUMsQ0FDNUQsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3BCLEtBQUssR0FBRyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUMzQixRQUFRLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDN0IsTUFBTSxDQUNKLGNBQWMsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksWUFBWSxFQUFFLENBQUMsQ0FDNUQsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3BCLEtBQUssR0FBRyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUMs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QUM5QixJQUFJLFFBQVEsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNqQyxNQUFNLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDbEUsS0FBSyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQzFCLFFBQVEsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUM3QixNQUFNLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDbEUsS0FBSyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQzFCLFFBQVEsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUM3QixNQUFNLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDbEUsS0FBSyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQzFCLFFBQVEsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUM3QixNQUFNLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDbEUsS0FBSyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQzFCLFFBQVEsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUM3QixNQUFNLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxRQUFR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