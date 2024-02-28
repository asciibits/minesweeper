import { BitSet, BitSetWriter } from '../io.js';
import { testRandom } from '../random.js';
import {
  HuffmanCode,
  SymbolPair,
  WeightedHuffmanSymbol,
  constructHuffmanCode,
  encodeHuffman,
  generateHuffmanCode,
} from './huffman.js';

describe('Huffman', () => {
  const identityMapping: SymbolPair[] = [
    [
      { value: 0, bitCount: 1 },
      { value: 0, bitCount: 1 },
    ],
    [
      { value: 1, bitCount: 1 },
      { value: 1, bitCount: 1 },
    ],
  ];
  const xorMapping: SymbolPair[] = [
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
  const simpleMapping: SymbolPair[] = [
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
  const fourMapping: SymbolPair[] = [
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
      } as HuffmanCode);
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
      } as HuffmanCode);
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
      } as HuffmanCode);
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
      } as HuffmanCode);
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
      expect(encodeHuffman(bitset.toReader(), code)).toEqual(
        new BitSetWriter().writeBatch(0b011001, 6).bitset,
      );
    });
    it('encodes with four-key transform', () => {
      // Maps the codes: [00, 10, 01, 11] to [0, 01, 011, 111]
      const bitset = new BitSet();
      bitset.toWriter().writeBatch(0b001000010011, 12);
      // Mapped bits: 0 01 0 011 0 111
      const code = constructHuffmanCode(fourMapping).encode;
      // it encodes the input
      expect(encodeHuffman(bitset.toReader(), code)).toEqual(
        new BitSetWriter().writeBatch(0b00100110111, 11).bitset,
      );
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
      } as HuffmanCode);
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
      } as HuffmanCode);
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
      } as HuffmanCode);
    });
  });
  it('handles round trip compression', () => {
    const samples = 200;
    for (let i = 0; i < samples; i++) {
      const bitCount = testRandom.getRandomInteger(9, 1);
      const symbols: WeightedHuffmanSymbol[] = [];
      for (let value = (1 << bitCount) - 1; value >= 0; value--) {
        symbols.push({
          value,
          bitCount,
          weight: testRandom.getRandomBits(16),
        });
      }
      const code = generateHuffmanCode(symbols);
      const digits = testRandom.getRandomInteger(1000, 100);
      const bitset = new BitSetWriter().writeBigBits(
        testRandom.getRandomBigBits(BigInt(digits * bitCount)),
        digits * bitCount,
      ).bitset;
      const encoded = encodeHuffman(bitset.toReader(), code.encode);
      const decoded = encodeHuffman(encoded.toReader(), code.decode);
      try {
        throwUnless(decoded).toEqual(bitset);
      } catch (e) {
        console.log(
          'Original: length: %d, value: %s',
          bitset.length,
          bitset.toBigInt().toString(16),
        );
        console.log(
          'Decoded : length: %d, value: %s',
          decoded.length,
          decoded.toBigInt().toString(16),
        );
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
