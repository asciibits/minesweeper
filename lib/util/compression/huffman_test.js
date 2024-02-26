import { BitSet, BitSetWriter } from '../io.js';
import { testRandom } from '../random.js';
import { constructHuffmanCode, encodeHuffman, generateHuffmanCode, } from './huffman.js';
describe('Huffman', () => {
    const identityMapping = [
        [
            { value: 0, bitCount: 1 },
            { value: 0, bitCount: 1 },
        ],
        [
            { value: 1, bitCount: 1 },
            { value: 1, bitCount: 1 },
        ],
    ];
    const xorMapping = [
        [
            { value: 0, bitCount: 1 },
            { value: 1, bitCount: 1 },
        ],
        [
            { value: 1, bitCount: 1 },
            { value: 0, bitCount: 1 },
        ],
    ];
    // Maps the codes: [0, 01, 11] to [1, 10, 00]
    const simpleMapping = [
        [
            { value: 0b0, bitCount: 1 },
            { value: 0b1, bitCount: 1 },
        ],
        [
            { value: 0b01, bitCount: 2 },
            { value: 0b10, bitCount: 2 },
        ],
        [
            { value: 0b11, bitCount: 2 },
            { value: 0b00, bitCount: 2 },
        ],
    ];
    // Maps the codes: [00, 10, 01, 11] to [0, 01, 011, 111]
    const fourMapping = [
        [
            { value: 0b00, bitCount: 2 },
            { value: 0b0, bitCount: 1 },
        ],
        [
            { value: 0b10, bitCount: 2 },
            { value: 0b01, bitCount: 2 },
        ],
        [
            { value: 0b01, bitCount: 2 },
            { value: 0b011, bitCount: 3 },
        ],
        [
            { value: 0b11, bitCount: 2 },
            { value: 0b111, bitCount: 3 },
        ],
    ];
    describe('constructHuffmanCode', () => {
        it('creates a trivial identity code', () => {
            // this is an identity mapping - it maps back to itself
            const code = constructHuffmanCode(identityMapping);
            expect(code).toEqual({
                encode: [
                    { value: 0, bitCount: 1 },
                    { value: 1, bitCount: 1 },
                ],
                decode: [
                    { value: 0, bitCount: 1 },
                    { value: 1, bitCount: 1 },
                ],
            });
        });
        it('creates a trivial xor code', () => {
            // this is an xor mapping - it maps 1 to 0, and 0 to 1
            const code = constructHuffmanCode(xorMapping);
            expect(code).toEqual({
                encode: [
                    { value: 1, bitCount: 1 },
                    { value: 0, bitCount: 1 },
                ],
                decode: [
                    { value: 1, bitCount: 1 },
                    { value: 0, bitCount: 1 },
                ],
            });
        });
        it('creates a small simple code', () => {
            // Maps the codes: [0, 01, 11] to [1, 10, 00]
            const code = constructHuffmanCode(simpleMapping);
            expect(code).toEqual({
                encode: [
                    { value: 0b1, bitCount: 1 },
                    [
                        { value: 0b10, bitCount: 2 },
                        { value: 0b00, bitCount: 2 },
                    ],
                ],
                decode: [
                    [
                        { value: 0b11, bitCount: 2 },
                        { value: 0b01, bitCount: 2 },
                    ],
                    { value: 0b0, bitCount: 1 },
                ],
            });
        });
        // Maps the codes: [00, 10, 01, 11] to [0, 01, 011, 111]
        it('creates a four-key simple code', () => {
            const code = constructHuffmanCode(fourMapping);
            expect(code).toEqual({
                encode: [
                    [
                        { value: 0b0, bitCount: 1 },
                        { value: 0b01, bitCount: 2 },
                    ],
                    [
                        { value: 0b011, bitCount: 3 },
                        { value: 0b111, bitCount: 3 },
                    ],
                ],
                decode: [
                    { value: 0b00, bitCount: 2 },
                    [
                        { value: 0b10, bitCount: 2 },
                        [
                            { value: 0b01, bitCount: 2 },
                            { value: 0b11, bitCount: 2 },
                        ],
                    ],
                ],
            });
        });
    });
    describe('encodeHuffman', () => {
        it('encodes with identity transform', () => {
            const bitset = new BitSet();
            bitset.toWriter().writeBatch(0b100110, 6);
            const code = constructHuffmanCode(identityMapping).encode;
            // it encodes to itself
            expect(encodeHuffman(bitset.toReader(), code)).toEqual(bitset);
        });
        it('encodes with xor transform', () => {
            const bitset = new BitSet();
            bitset.toWriter().writeBatch(0b100110, 6);
            const code = constructHuffmanCode(xorMapping).encode;
            // it encodes to its xor'ed value
            expect(encodeHuffman(bitset.toReader(), code)).toEqual(new BitSetWriter().writeBatch(0b011001, 6).bitset);
        });
        it('encodes with four-key transform', () => {
            // Maps the codes: [00, 10, 01, 11] to [0, 01, 011, 111]
            const bitset = new BitSet();
            bitset.toWriter().writeBatch(0b001000010011, 12);
            // Mapped bits: 0 01 0 011 0 111
            const code = constructHuffmanCode(fourMapping).encode;
            // it encodes the input
            expect(encodeHuffman(bitset.toReader(), code)).toEqual(new BitSetWriter().writeBatch(0b00100110111, 11).bitset);
        });
    });
    describe('generateHuffmanCode', () => {
        it('generates equal weight two value code', () => {
            const code = generateHuffmanCode([
                { value: 0b0, bitCount: 1, weight: 1 },
                { value: 0b1, bitCount: 1, weight: 1 },
            ]);
            expect(code).toEqual({
                encode: [
                    { value: 0, bitCount: 1 },
                    { value: 1, bitCount: 1 },
                ],
                decode: [
                    { value: 0, bitCount: 1 },
                    { value: 1, bitCount: 1 },
                ],
            });
        });
        it('generates equal weight, four value code', () => {
            const code = generateHuffmanCode([
                { value: 0b00, bitCount: 2, weight: 1 },
                { value: 0b10, bitCount: 2, weight: 1 },
                { value: 0b01, bitCount: 2, weight: 1 },
                { value: 0b11, bitCount: 2, weight: 1 },
            ]);
            expect(code).toEqual({
                encode: [
                    [
                        { value: 0b00, bitCount: 2 },
                        { value: 0b10, bitCount: 2 },
                    ],
                    [
                        { value: 0b01, bitCount: 2 },
                        { value: 0b11, bitCount: 2 },
                    ],
                ],
                decode: [
                    [
                        { value: 0b00, bitCount: 2 },
                        { value: 0b10, bitCount: 2 },
                    ],
                    [
                        { value: 0b01, bitCount: 2 },
                        { value: 0b11, bitCount: 2 },
                    ],
                ],
            });
        });
        it('generates off weight, four value code', () => {
            const code = generateHuffmanCode([
                { value: 0b00, bitCount: 2, weight: 1 },
                { value: 0b10, bitCount: 2, weight: 100 },
                { value: 0b01, bitCount: 2, weight: 1000 },
                { value: 0b11, bitCount: 2, weight: 10 },
            ]);
            expect(code).toEqual({
                encode: [
                    [
                        { value: 0b011, bitCount: 3 },
                        { value: 0b01, bitCount: 2 },
                    ],
                    [
                        { value: 0b0, bitCount: 1 },
                        { value: 0b111, bitCount: 3 },
                    ],
                ],
                decode: [
                    { value: 0b01, bitCount: 2 },
                    [
                        { value: 0b10, bitCount: 2 },
                        [
                            { value: 0b00, bitCount: 2 },
                            { value: 0b11, bitCount: 2 },
                        ],
                    ],
                ],
            });
        });
    });
    it('handles round trip compression', () => {
        const samples = 200;
        for (let i = 0; i < samples; i++) {
            const bitCount = testRandom.getRandomInteger(9, 1);
            const symbols = [];
            for (let value = (1 << bitCount) - 1; value >= 0; value--) {
                symbols.push({
                    value,
                    bitCount,
                    weight: testRandom.getRandomBits(16),
                });
            }
            const code = generateHuffmanCode(symbols);
            const digits = testRandom.getRandomInteger(1000, 100);
            const bitset = new BitSetWriter().writeBigBits(testRandom.getRandomBigBits(BigInt(digits * bitCount)), digits * bitCount).bitset;
            const encoded = encodeHuffman(bitset.toReader(), code.encode);
            const decoded = encodeHuffman(encoded.toReader(), code.decode);
            try {
                throwUnless(decoded).toEqual(bitset);
            }
            catch (e) {
                console.log('Original: length: %d, value: %s', bitset.length, bitset.toBigInt().toString(16));
                console.log('Decoded : length: %d, value: %s', decoded.length, decoded.toBigInt().toString(16));
                console.log('Symbols: %s', JSON.stringify(symbols));
                throw e;
            }
        }
    });
    // it('test single round trip', () => {
    //   const bitset = new BitSet().appendBigBits(0x73e785cdd50c586ae6n, 71);
    //   const symbols = [
    //     { value: 1, bitCount: 1, weight: 69 },
    //     { value: 0, bitCount: 1, weight: 33 },
    //   ];
    //   const huffmanCode = generateHuffmanCode(symbols);
    //   const encoded = encodeHuffman(bitset, huffmanCode.encode);
    //   const decoded = encodeHuffman(encoded, huffmanCode.decode);
    //   console.log(
    //     'Original: length: %d, value: %s',
    //     bitset.length,
    //     bitset.toBigInt().toString(16)
    //   );
    //   console.log(
    //     'Decoded : length: %d, value: %s',
    //     decoded.length,
    //     decoded.toBigInt().toString(16)
    //   );
    //   console.log('Symbols: %s', JSON.stringify(symbols));
    //   expect(decoded).toEqual(bitset);
    // });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHVmZm1hbl90ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3V0aWwvY29tcHJlc3Npb24vaHVmZm1hbl90ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBQ2hELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxjQUFjLENBQUM7QUFDMUMsT0FBTyxFQUlMLG9CQUFvQixFQUNwQixhQUFhLEVBQ2IsbUJBQW1CLEdBQ3BCLE1BQU0sY0FBYyxDQUFDO0FBRXRCLFFBQVEsQ0FBQyxTQUFTLEVBQUUsR0FBRyxFQUFFO0lBQ3ZCLE1BQU0sZUFBZSxHQUFpQjtRQUNwQztZQUNFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFO1lBQ3pCLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFO1NBQzFCO1FBQ0Q7WUFDRSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRTtZQUN6QixFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRTtTQUMxQjtLQUNGLENBQUM7SUFDRixNQUFNLFVBQVUsR0FBaUI7UUFDL0I7WUFDRSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRTtZQUN6QixFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRTtTQUMxQjtRQUNEO1lBQ0UsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUU7WUFDekIsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUU7U0FDMUI7S0FDRixDQUFDO0lBQ0YsNkNBQTZDO0lBQzdDLE1BQU0sYUFBYSxHQUFpQjtRQUNsQztZQUNFLEVBQUUsS0FBSyxF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