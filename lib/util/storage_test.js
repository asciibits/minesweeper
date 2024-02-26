import { BitSet } from './io.js';
import { testRandom } from './random.js';
import { BitExtendedCoder, DeltaCoder, InterleaveCoder, VariableLengthQuantityCoder, encodeGrid, encodeToBitset, } from './storage.js';
import { bitset } from './test_utils.js';
describe('Storage', () => {
    describe('Variable Length Coder', () => {
        function encodeContinuous(val, infoBitCount) {
            return typeof val === 'number'
                ? encodeToBitset(val, new VariableLengthQuantityCoder(infoBitCount))
                : encodeToBitset(val, new VariableLengthQuantityCoder(infoBitCount).bigintCoder());
        }
        function decodeContinuous(input, infoBitCount) {
            return new VariableLengthQuantityCoder(infoBitCount).decode(input);
        }
        function decodeBigContinuous(input, bitCount) {
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
                expect(encodeContinuous(0x34e5c427f7b4734d9800n, 5)).toEqual(bitset(0x1b3cbca29ff7db1e74ee6820n, 96));
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
                expect(decodeContinuous(bitset(0b000001100000, 12).toReader(), 5)).toBe(32);
                expect(decodeContinuous(bitset(0b010110111101, 12).toReader(), 5)).toBe(733);
                expect(decodeContinuous(bitset(0b011111111111, 12).toReader(), 5)).toBe(1023);
            });
            it('decodes a few large values', () => {
                // I didn't actually test these manually... they are here in case
                // something changes
                expect(decodeBigContinuous(bitset(0xe9b1f61a77c25bbbda9ef4dab934n, 114).toReader(), 5)).toBe(0x38d1e8537815dbb2774b2c94n);
                expect(decodeBigContinuous(bitset(0x1b3cbca29ff7db1e74ee6820n, 96).toReader(), 5)).toBe(0x34e5c427f7b4734d9800n);
            });
        });
        it('encodes / decodes round trip', () => {
            const samples = 100;
            for (let i = 0; i < samples; i++) {
                const val = testRandom.getRandomBits(32) >> 0;
                const bitCount = testRandom.getRandomInteger(32, 1);
                let encoded = undefined;
                let decoded = undefined;
                try {
                    encoded = encodeContinuous(val, bitCount);
                    decoded = decodeContinuous(encoded.toReader(), bitCount);
                    throwUnless(decoded).toBe(val);
                }
                catch (e) {
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
                const val = testRandom.getRandomBigBits(1000n);
                const bitCount = testRandom.getRandomInteger(32, 1);
                const encoded = encodeContinuous(val, bitCount);
                const decoded = decodeBigContinuous(encoded.toReader(), bitCount);
                if (decoded !== val) {
                    console.log('Round trip failed.\nBitcount: %d\nVal: 0x%s\ndecoded: 0x%s', bitCount, val.toString(16), decoded.toString(16));
                    console.log('Encoded: %o', encoded);
                    throw new Error('Round trip failed for continuous integer encoding. See logs');
                }
            }
        });
    });
    describe('Bit Extended', () => {
        function encodeBitExtended(val, infoBitCount) {
            return typeof val === 'number'
                ? encodeToBitset(val, new BitExtendedCoder(infoBitCount))
                : encodeToBitset(val, new BitExtendedCoder(infoBitCount).bigintCoder());
        }
        function decodeBitExtended(input, infoBitCount) {
            return new BitExtendedCoder(infoBitCount).decode(input);
        }
        function decodeBigBitExtended(input, infoBitCount) {
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
                expect(encodeBitExtended(0b1001011010100101101011101010, 2)).toEqual(bitset(3306157308313326n, 54));
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
                expect(decodeBitExtended(bitset(0b0011000, 7).toReader(), 3)).toEqual(16);
                expect(decodeBitExtended(bitset(0b0011111, 7).toReader(), 3)).toEqual(23);
                expect(decodeBitExtended(bitset(0b0111000, 7).toReader(), 3)).toEqual(24);
            });
            it('decodes bigint with bitcount 3', () => {
                expect(decodeBigBitExtended(bitset(0b0000, 4).toReader(), 3)).toEqual(0n);
                expect(decodeBigBitExtended(bitset(0b0001, 4).toReader(), 3)).toEqual(1n);
                expect(decodeBigBitExtended(bitset(0b0111, 4).toReader(), 3)).toEqual(7n);
                expect(decodeBigBitExtended(bitset(0b01000, 5).toReader(), 3)).toEqual(8n);
                expect(decodeBigBitExtended(bitset(0b01001, 5).toReader(), 3)).toEqual(9n);
                expect(decodeBigBitExtended(bitset(0b01010, 5).toReader(), 3)).toEqual(10n);
                expect(decodeBigBitExtended(bitset(0b01111, 5).toReader(), 3)).toEqual(15n);
                expect(decodeBigBitExtended(bitset(0b0011000, 7).toReader(), 3)).toEqual(16n);
                expect(decodeBigBitExtended(bitset(0b0011111, 7).toReader(), 3)).toEqual(23n);
                expect(decodeBigBitExtended(bitset(0b0111000, 7).toReader(), 3)).toEqual(24n);
            });
        });
        it('encodes 32-bit round trip', () => {
            const samples = 100;
            for (let i = 0; i < samples; i++) {
                const val = testRandom.getRandomBits(testRandom.getRandomInteger(33, 1)) >> 0;
                const bitCount = testRandom.getRandomInteger(32);
                if (val === 0 && bitCount === 0) {
                    // can't encode 0/0
                    continue;
                }
                let encoded;
                let decoded;
                try {
                    encoded = encodeBitExtended(val, bitCount);
                    decoded = decodeBitExtended(encoded.toReader(), bitCount);
                    throwUnless(decoded).toBe(val);
                }
                catch (e) {
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
                const val = testRandom.getRandomBigBits(testRandom.getRandomBigInteger(1000n, 1n));
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
        expect(encodeGrid(input, 10).toBigInt()).toBe(2n);
        input = new BitSet();
        input.toWriter().writeBigBits(-1n, 120);
        expect(encodeGrid(input, 6).toBigInt()).toBe(2n);
    });
    it('encodes all zeros', () => {
        let input = new BitSet();
        input.toWriter().writeBigBits(0n, 100);
        expect(encodeGrid(input, 10).toBigInt()).toBe(0n);
        input = new BitSet();
        input.toWriter().writeBigBits(0n, 120);
        expect(encodeGrid(input, 6).toBigInt()).toBe(0n);
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
        expect(encodeGrid(input, 8).toBigInt()).toBe(16223015258104432038696631n);
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
        expect(encodeGrid(input, 8).toBigInt()).toBe(261n);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcmFnZV90ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V0aWwvc3RvcmFnZV90ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxNQUFNLEVBQWEsTUFBTSxTQUFTLENBQUM7QUFDNUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUN6QyxPQUFPLEVBQ0wsZ0JBQWdCLEVBQ2hCLFVBQVUsRUFDVixlQUFlLEVBQ2YsMkJBQTJCLEVBQzNCLFVBQVUsRUFDVixjQUFjLEdBQ2YsTUFBTSxjQUFjLENBQUM7QUFDdEIsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBRXpDLFFBQVEsQ0FBQyxTQUFTLEVBQUUsR0FBRyxFQUFFO0lBQ3ZCLFFBQVEsQ0FBQyx1QkFBdUIsRUFBRSxHQUFHLEVBQUU7UUFDckMsU0FBUyxnQkFBZ0IsQ0FDdkIsR0FBb0IsRUFDcEIsWUFBb0I7WUFFcEIsT0FBTyxPQUFPLEdBQUcsS0FBSyxRQUFRO2dCQUM1QixDQUFDLENBQUMsY0FBYyxDQUFDLEdBQUcsRUFBRSxJQUFJLDJCQUEyQixDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUNwRSxDQUFDLENBQUMsY0FBYyxDQUNaLEdBQUcsRUFDSCxJQUFJLDJCQUEyQixDQUFDLFlBQVksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUM1RCxDQUFDO1FBQ1IsQ0FBQztRQUVELFNBQVMsZ0JBQWdCLENBQUMsS0FBZ0IsRUFBRSxZQUFvQjtZQUM5RCxPQUFPLElBQUksMkJBQTJCLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3JFLENBQUM7UUFFRCxTQUFTLG1CQUFtQixDQUFDLEtBQWdCLEVBQUUsUUFBZ0I7WUFDN0QsT0FBTyxJQUFJLDJCQUEyQixDQUFDLFFBQVEsQ0FBQyxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN2RSxDQUFDO1FBQ0Qs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Z0JBQzNDLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ25ELENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7UUFDSCxRQUFRLENBQUMsUUFBUSxFQUFFLEdBQUcsRUFBRTtZQUN0QixFQUFFLENBQUMsb0JBQW9CLEVBQUUsR0FBRyxFQUFFO2dCQUM1QixNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUNsRCxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDMUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUMxQyxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDMUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDM0MsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDM0MsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDM0MsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7WUFDbkQsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ0gsUUFBUSxDQUFDLGNBQWMsRUFBRSxHQUFHLEVBQUU7UUFDNUIsUUFBUSxDQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUU7WUFDdEIsRUFBRSxDQUFDLGVBQWUsRUFBRSxHQUFHLEVBQUU7Z0JBQ3ZCLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDeEMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN4QyxNQUFNLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hDLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDeEMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN4QyxNQUFNLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hDLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDeEMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN4QyxNQUFNLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hDLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDeEMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUMxQyxNQUFNLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQzFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUM1QyxDQUFDLENBQUMsQ0FBQztZQUNILEVBQUUsQ0FBQyx3QkFBd0IsRUFBRSxHQUFHLEVBQUU7Z0JBQ2hDLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzNDLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzNDLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzNDLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzNDLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzNDLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzVDLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzVDLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzVDLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzVDLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDOUMsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztRQUNILFFBQVEsQ0FBQyxRQUFRLEVBQUUsR0FBRyxFQUFFO1lBQ3RCLEVBQUUsQ0FBQyxlQUFlLEVBQUUsR0FBRyxFQUFFO2dCQUN2QixNQUFNLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUMzQyxNQUFNLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUMzQyxNQUFNLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUMzQyxNQUFNLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUMzQyxNQUFNLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUM1QyxNQUFNLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUMzQyxNQUFNLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUM1QyxNQUFNLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUM1QyxNQUFNLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUM1QyxNQUFNLENBQUMsVUFBVSxDQUFDLE1B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