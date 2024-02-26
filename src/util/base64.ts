import { BitReader, BitWriter } from './io.js';

// URL safe variant
export const base64Digits =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const reverseBase64Digits = new Array<number>(128);
for (let i = 0; i < base64Digits.length; i++) {
  reverseBase64Digits[base64Digits.charCodeAt(i)] = i;
}

/**
 * Encode the bitset in Base64. Returns an iterator of individual characters.
 */
export function encodeBase64(input: BitReader): string {
  const output: string[] = [];
  let val = 0;
  let bits = 0;
  for (;;) {
    const toRead = Math.min(6 - bits, input.pending());
    val |= input.readBatch(toRead) << bits;
    bits += toRead;
    if (bits === 6 || (bits > 0 && toRead === 0)) {
      output.push(base64Digits[val]);
      val = 0;
      bits = 0;
    }
    if (!toRead) {
      return output.join('');
    }
  }
}

export function decodeBase64(input: string, output: BitWriter): void {
  for (const c of input) {
    output.writeBatch(reverseBase64Digits[c.charCodeAt(0)], 6);
  }
}
