import { decodeBase64, encodeBase64 } from './base64.js';
import { BitSet, BitSetWriter, BitSourceReader, BitReader } from './io.js';
import { random } from './random.js';
import { bitset } from './test_utils.js';

describe('Base64 Encoding', () => {
  function encode(source: BitReader, padEnd?: boolean): string;
  function encode(digits: number[], padEnd?: boolean): string;
  function encode(val: bigint, padEnd?: boolean): string;
  function encode(source: BitReader | number[] | bigint): string {
    if (Array.isArray(source)) {
      source = BitSourceReader.create(source, 6);
    } else if (typeof source === 'bigint') {
      source = new BitSetWriter().writeBigBits(source).bitset.toReader();
    }
    return [...encodeBase64(source)].join('');
  }

  function decode(encoded: string): BitSet {
    const writer = new BitSetWriter();
    decodeBase64(encoded, writer);
    return writer.bitset;
  }
  describe('encodeBase64', () => {
    it('encodes zero bits as empty', () => {
      expect(encode(new BitSet().toReader())).toBe('');
    });
    it('encodes 6 bits', () => {
      expect(encode([1])).toEqual('B');
      expect(encode([8])).toEqual('I');
      expect(encode([9])).toEqual('J');
      expect(encode([16])).toEqual('Q');
      expect(encode([17])).toEqual('R');
      expect(encode([42])).toEqual('q');
      expect(encode([63])).toEqual('_');
    });
    it('encodes double digits', () => {
      expect(encode([0, 1])).toBe('AB');
      expect(encode([33, 54])).toBe('h2');
      expect(encode([63, 63])).toBe('__');
      expect(encode([63, 63, 63, 63, 63, 3])).toBe('_____D');
      expect(encode([63, 63, 63, 63, 63, 63])).toBe('______');
    });
    it('encodes simple numbers', () => {
      expect(encode(0xabcn)).toBe('8q');
      expect(encode(0x1abcn)).toBe('8qB');
      expect(encode(0xaaan)).toBe('qq');
      expect(encode(0xaaaaaaaaan)).toBe('qqqqqq');
    });
    it('encodes bigints', () => {
      expect(encode(0xffffffffn)).toBe('_____D');
      expect(encode(0xfffffffffn)).toBe('______');
      expect(encode(3393966825983452340611442412n)).toBe('sb-rZD9hC3kbsdvC');
    });
  });
  describe('base64Decode', () => {
    it('decodes empty as zero', () => {
      expect(decode('')).toEqual(new BitSet());
    });
    it('decodes single digits', () => {
      expect(decode('B')).toEqual(bitset([1], 6));
      expect(decode('I')).toEqual(bitset([8], 6));
      expect(decode('J')).toEqual(bitset([9], 6));
      expect(decode('Q')).toEqual(bitset([16], 6));
      expect(decode('R')).toEqual(bitset([17], 6));
      expect(decode('q')).toEqual(bitset([42], 6));
      expect(decode('_')).toEqual(bitset([63], 6));
    });
    it('decodes double digits', () => {
      expect(decode('AB')).toEqual(bitset([0, 1], 6));
      expect(decode('h2')).toEqual(bitset([33, 54], 6));
      expect(decode('__')).toEqual(bitset([63, 63], 6));
      expect(decode('_____D')).toEqual(bitset([63, 63, 63, 63, 63, 3], 6));
      expect(decode('______')).toEqual(bitset([63, 63, 63, 63, 63, 63], 6));
    });
    it('decodes simple numbers', () => {
      expect(decode('8q')).toEqual(bitset(0xabcn));
      expect(decode('8qB')).toEqual(bitset(0x1abcn, 18));
      expect(decode('qq')).toEqual(bitset(0xaaan));
      expect(decode('qqqqqq')).toEqual(bitset(0xaaaaaaaaan));
    });
    it('decodes bigints', () => {
      expect(decode('_____D')).toEqual(bitset(0xffffffffn, 36));
      expect(decode('______')).toEqual(bitset(0xfffffffffn));
      expect(decode('sb-rZD9hC3kbsdvC')).toEqual(
        bitset(3393966825983452340611442412n, 96),
      );
    });
  });
  it('handles random round trip', () => {
    const samples = 100;
    for (let i = 0; i < samples; i++) {
      const val = random.getRandomBigBits(100n);
      const bitset = BitSet.fromBigint(val);
      const encoded = encodeBase64(bitset.toReader());
      const decoded = new BitSet();
      decodeBase64(encoded, decoded.toWriter());
      expect(Math.abs(decoded.length - bitset.length)).toBeLessThan(6);
      decoded.length = bitset.length;
      try {
        throwUnless(decoded).toEqual(bitset);
      } catch (e) {
        console.log('base64 [en/de]coding failed for: %s', val.toString(16));
        throw e;
      }
    }
  });
});
