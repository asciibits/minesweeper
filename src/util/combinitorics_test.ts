import {
  bitmapFromLexicalOrdering,
  combinations,
  lexicalOrdering,
} from './combinitorics.js';
import { testRandom } from './random.js';

describe('combinations', () => {
  it('rejects invalid input', () => {
    expect(() => combinations(-1, 0)).toThrow();
    expect(() => combinations(2, 3)).toThrow();
    expect(() => combinations(2, -1)).toThrow();
  });
  it('calculates the correct value', () => {
    expect(combinations(10, 4)).toBe(210n);
    expect(combinations(10, 6)).toBe(210n);
    expect(combinations(10, 6)).toBe(210n);
    // test values that exceed 2^64
    expect(combinations(70, 30)).toBe(55347740058143507128n);
  });
  it('returns 1 for all nCn and nC0', () => {
    expect(combinations(0, 0)).toBe(1n);
    expect(combinations(1, 1)).toBe(1n);
    expect(combinations(1, 0)).toBe(1n);
    expect(combinations(2, 2)).toBe(1n);
    expect(combinations(2, 0)).toBe(1n);
    expect(combinations(3, 3)).toBe(1n);
    expect(combinations(3, 0)).toBe(1n);
  });
});

describe('Lexical Ordering', () => {
  describe('lexicalOrdering', () => {
    it('returns zero when all marks are at the end', () => {
      expect(lexicalOrdering(0b0n, 1)).toBe(0n);
      expect(lexicalOrdering(0b1n, 1)).toBe(0n);
      expect(lexicalOrdering(0b011n, 3)).toBe(0n);
      expect(lexicalOrdering(0b0000n, 4)).toBe(0n);
      expect(lexicalOrdering(0b0001n, 4)).toBe(0n);
      expect(lexicalOrdering(0b0011n, 4)).toBe(0n);
      expect(lexicalOrdering(0b0111n, 4)).toBe(0n);
      expect(lexicalOrdering(0b1111n, 4)).toBe(0n);
    });
    it('returns choose - 1 when marks are all at the beginning', () => {
      expect(lexicalOrdering(0b0n, 1)).toBe(combinations(1, 0) - 1n);
      expect(lexicalOrdering(0b1n, 1)).toBe(combinations(1, 1) - 1n);
      expect(lexicalOrdering(0b10n, 2)).toBe(combinations(2, 1) - 1n);
      expect(lexicalOrdering(0b100n, 3)).toBe(combinations(3, 1) - 1n);
      expect(lexicalOrdering(0b110n, 3)).toBe(combinations(3, 2) - 1n);
      expect(lexicalOrdering(0b0000n, 4)).toBe(combinations(4, 0) - 1n);
      expect(lexicalOrdering(0b1000n, 4)).toBe(combinations(4, 1) - 1n);
      expect(lexicalOrdering(0b1100n, 4)).toBe(combinations(4, 2) - 1n);
      expect(lexicalOrdering(0b1110n, 4)).toBe(combinations(4, 3) - 1n);
      expect(lexicalOrdering(0b1111n, 4)).toBe(combinations(4, 4) - 1n);
    });
    it('returns expected id for n: 5, k: 2', () => {
      expect(lexicalOrdering(0b00011n, 5)).toBe(0n);
      expect(lexicalOrdering(0b00101n, 5)).toBe(1n);
      expect(lexicalOrdering(0b00110n, 5)).toBe(2n);
      expect(lexicalOrdering(0b01001n, 5)).toBe(3n);
      expect(lexicalOrdering(0b01010n, 5)).toBe(4n);
      expect(lexicalOrdering(0b01100n, 5)).toBe(5n);
      expect(lexicalOrdering(0b10001n, 5)).toBe(6n);
      expect(lexicalOrdering(0b10010n, 5)).toBe(7n);
      expect(lexicalOrdering(0b10100n, 5)).toBe(8n);
      expect(lexicalOrdering(0b11000n, 5)).toBe(9n);
    });
  });
  describe('bitmapFromLexicalOrdering', () => {
    it('returns marks at the end with zero', () => {
      expect(bitmapFromLexicalOrdering(0n, 1, 0)).toBe(0b0n);
      expect(bitmapFromLexicalOrdering(0n, 1, 1)).toBe(0b1n);
      expect(bitmapFromLexicalOrdering(0n, 3, 2)).toBe(0b011n);
      expect(bitmapFromLexicalOrdering(0n, 4, 0)).toBe(0b0000n);
      expect(bitmapFromLexicalOrdering(0n, 4, 1)).toBe(0b0001n);
      expect(bitmapFromLexicalOrdering(0n, 4, 2)).toBe(0b0011n);
      expect(bitmapFromLexicalOrdering(0n, 4, 3)).toBe(0b0111n);
      expect(bitmapFromLexicalOrdering(0n, 4, 4)).toBe(0b1111n);
    });
    it('returns marks all at the beginning with choose - 1', () => {
      expect(bitmapFromLexicalOrdering(combinations(1, 0) - 1n, 1, 0)).toBe(
        0b0n,
      );
      expect(bitmapFromLexicalOrdering(combinations(1, 1) - 1n, 1, 1)).toBe(
        0b1n,
      );
      expect(bitmapFromLexicalOrdering(combinations(2, 1) - 1n, 2, 1)).toBe(
        0b10n,
      );
      expect(bitmapFromLexicalOrdering(combinations(3, 1) - 1n, 3, 1)).toBe(
        0b100n,
      );
      expect(bitmapFromLexicalOrdering(combinations(3, 2) - 1n, 3, 2)).toBe(
        0b110n,
      );
      expect(bitmapFromLexicalOrdering(combinations(4, 0) - 1n, 4, 0)).toBe(
        0b0000n,
      );
      expect(bitmapFromLexicalOrdering(combinations(4, 1) - 1n, 4, 1)).toBe(
        0b1000n,
      );
      expect(bitmapFromLexicalOrdering(combinations(4, 2) - 1n, 4, 2)).toBe(
        0b1100n,
      );
      expect(bitmapFromLexicalOrdering(combinations(4, 3) - 1n, 4, 3)).toBe(
        0b1110n,
      );
      expect(bitmapFromLexicalOrdering(combinations(4, 4) - 1n, 4, 4)).toBe(
        0b1111n,
      );
    });
    it('returns expected map for all n: 5, k: 2', () => {
      expect(bitmapFromLexicalOrdering(0n, 5, 2)).toBe(0b00011n);
      expect(bitmapFromLexicalOrdering(1n, 5, 2)).toBe(0b00101n);
      expect(bitmapFromLexicalOrdering(2n, 5, 2)).toBe(0b00110n);
      expect(bitmapFromLexicalOrdering(3n, 5, 2)).toBe(0b01001n);
      expect(bitmapFromLexicalOrdering(4n, 5, 2)).toBe(0b01010n);
      expect(bitmapFromLexicalOrdering(5n, 5, 2)).toBe(0b01100n);
      expect(bitmapFromLexicalOrdering(6n, 5, 2)).toBe(0b10001n);
      expect(bitmapFromLexicalOrdering(7n, 5, 2)).toBe(0b10010n);
      expect(bitmapFromLexicalOrdering(8n, 5, 2)).toBe(0b10100n);
      expect(bitmapFromLexicalOrdering(9n, 5, 2)).toBe(0b11000n);
    });
  });
  it('reverses random round-trip', () => {
    const samples = 100;
    for (let i = 0; i < samples; i++) {
      const n =
        testRandom.getRandomInteger(100, 1) *
        testRandom.getRandomInteger(100, 1);
      const k = testRandom.getRandomInteger(n + 1);
      const c = combinations(n, k);
      const lexical = testRandom.getRandomBigInteger(c);
      if (
        lexical !== lexicalOrdering(bitmapFromLexicalOrdering(lexical, n, k), n)
      ) {
        console.log('Round trip failed:\n%o', { n, k, lexical });
        throw new Error('Round trip lexical ordering failure. Check logs.');
      }
    }
  });
});
